package replyclassify

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// Layer 3: the OPTIONAL model classifier, gated by OPENAI_API_KEY. It mirrors
// the repo's existing OPENAI_API_KEY-gated warmup-AI pattern: a client is only
// constructed when the key is present, and when it is absent the layer is a pure
// no-op that resolves the ambiguous middle to "unknown" WITHOUT any network
// call. The cheap, deterministic layers (headers, lexicon) run first and decide
// most replies, so this layer only ever sees the genuinely ambiguous tail.
//
// The model is constrained to the three nuanced sentiment classes the cheap
// layers can't separate: positive | negative | neutral. Compliance
// (unsubscribe) and automation (auto_reply / out_of_office) are already settled
// deterministically upstream and are intentionally NOT in the model's output
// space.

const (
	openAIChatURL  = "https://api.openai.com/v1/chat/completions"
	openAIModel    = "gpt-4o-mini"
	modelTimeout   = 8 * time.Second
	modelMaxTokens = 16
)

// modelClassifier is the package-level, lazily-initialized Layer 3 client. nil
// means "not configured" (no OPENAI_API_KEY) — the same disabled state the
// warmupcontent service expresses with a nil generation client.
var (
	modelOnce   sync.Once
	modelClient *openAIClassifier
)

// classifyModel runs Layer 3 when configured. Returns (zero, false) when the key
// is unset or the call fails, so the caller falls back to "unknown" and NEVER
// hard-errors on a classification miss.
func classifyModel(ctx context.Context, in Input) (Result, bool) {
	c := modelClassifierInstance()
	if c == nil {
		return Result{}, false
	}
	return c.classify(ctx, in)
}

// modelClassifierInstance reads OPENAI_API_KEY once and builds the client only
// when present. Identical gating to generation.NewClient being called only when
// the optional key resolves non-empty.
func modelClassifierInstance() *openAIClassifier {
	modelOnce.Do(func() {
		key := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
		if key == "" {
			return // stays nil => disabled, offline, never calls out
		}
		modelClient = &openAIClassifier{
			apiKey: key,
			http:   &http.Client{Timeout: modelTimeout},
		}
	})
	return modelClient
}

type openAIClassifier struct {
	apiKey string
	http   *http.Client
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	MaxTokens   int           `json:"max_tokens"`
	Temperature float64       `json:"temperature"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

const modelSystemPrompt = "You classify the sentiment of a reply to a cold sales email. " +
	"Reply with exactly one lowercase word and nothing else: positive (interested / wants to talk), " +
	"negative (rejection / not interested), or neutral (a question, deferral, or anything unclear). " +
	"Do not explain."

func (c *openAIClassifier) classify(ctx context.Context, in Input) (Result, bool) {
	user := strings.TrimSpace("Subject: " + in.Subject + "\n\n" + in.BodyText)
	if user == "" {
		return Result{}, false
	}

	body, err := json.Marshal(chatRequest{
		Model:       openAIModel,
		MaxTokens:   modelMaxTokens,
		Temperature: 0,
		Messages: []chatMessage{
			{Role: "system", Content: modelSystemPrompt},
			{Role: "user", Content: user},
		},
	})
	if err != nil {
		return Result{}, false
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openAIChatURL, bytes.NewReader(body))
	if err != nil {
		return Result{}, false
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return Result{}, false
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return Result{}, false
	}

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	if err != nil {
		return Result{}, false
	}
	var parsed chatResponse
	if err := json.Unmarshal(raw, &parsed); err != nil || len(parsed.Choices) == 0 {
		return Result{}, false
	}

	switch normalizeModelLabel(parsed.Choices[0].Message.Content) {
	case ClassPositive:
		return Result{Class: ClassPositive, Confidence: 0.7, Source: SourceModel}, true
	case ClassNegative:
		return Result{Class: ClassNegative, Confidence: 0.7, Source: SourceModel}, true
	case ClassNeutral:
		return Result{Class: ClassNeutral, Confidence: 0.6, Source: SourceModel}, true
	default:
		return Result{}, false
	}
}

// normalizeModelLabel reduces the model's free text to one of the three allowed
// labels, tolerating stray punctuation/whitespace. Anything else is rejected so
// the caller falls back to "unknown".
func normalizeModelLabel(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.Trim(s, ".\"' \n\t")
	switch {
	case strings.HasPrefix(s, ClassPositive):
		return ClassPositive
	case strings.HasPrefix(s, ClassNegative):
		return ClassNegative
	case strings.HasPrefix(s, ClassNeutral):
		return ClassNeutral
	default:
		return ""
	}
}
