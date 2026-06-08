package integration

import (
	"bytes"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"text/template"

	"github.com/warmbly/warmbly/internal/app/webhook"
	"github.com/warmbly/warmbly/internal/pkg/tmplfuncs"
)

// exprFuncs is the shared customization helper set (arithmetic, coercing numeric
// comparison, string helpers, default/fallback) available inside automation
// condition expressions and action templates. The built-in eq/ne/lt/le/gt/ge and
// and/or/not also work (natively when a value is already a number; use the *f
// variants or num to force numeric comparison on strings). Shared with campaign
// email bodies via internal/pkg/tmplfuncs.
var exprFuncs = tmplfuncs.FuncMap()

var exprTmplCache sync.Map // expr string -> *template.Template, or badTemplate

// prepExpr lets a user write either a full template (`{{if gt .x 1}}y{{end}}`)
// or a bare boolean pipeline (`gt .x 1`), which we wrap in an {{if}}.
func prepExpr(expr string) string {
	expr = strings.TrimSpace(expr)
	if !strings.Contains(expr, "{{") {
		return "{{if " + expr + "}}true{{end}}"
	}
	return expr
}

func compileExpr(expr string) *template.Template {
	if v, ok := exprTmplCache.Load(expr); ok {
		if v == badTemplate {
			return nil
		}
		return v.(*template.Template)
	}
	t, err := template.New("cond").Funcs(exprFuncs).Option("missingkey=zero").Parse(prepExpr(expr))
	if err != nil {
		exprTmplCache.Store(expr, badTemplate)
		return nil
	}
	exprTmplCache.Store(expr, t)
	return t
}

// EvalExpression renders a condition expression against the NATIVE event data
// (numbers stay numbers) and reports whether it is "truthy" — i.e. renders a
// non-empty, non-false value. Any parse/exec failure is a false (a broken
// condition never silently passes).
func EvalExpression(expr string, data map[string]any) bool {
	if strings.TrimSpace(expr) == "" {
		return false
	}
	t := compileExpr(expr)
	if t == nil {
		return false
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(buf.String())) {
	case "", "false", "0", "no", "off", "<no value>":
		return false
	}
	return true
}

// ValidExpression reports whether a condition expression parses (used on write,
// so a campaign can't be saved with a broken predicate).
func ValidExpression(expr string) error {
	if strings.TrimSpace(expr) == "" {
		return fmt.Errorf("expression is empty")
	}
	if _, err := template.New("cond").Funcs(exprFuncs).Option("missingkey=zero").Parse(prepExpr(expr)); err != nil {
		return err
	}
	return nil
}

// Templating for automation/integration action values (message bodies, channels,
// webhook URLs, CRM static field values). Renders Go text/template against the
// flat event-data map so users can write {{.contact_email}} (or bare
// {{contact_email}}) plus conditionals/pipelines. Unknown keys render empty.
// Never hard-fails: any parse/exec error falls back to naive {{key}}
// substitution, preserving the simple syntax users already typed.

var tmplCache sync.Map // string -> *template.Template, or the badTemplate sentinel

// Bound the cache so an attacker can't grow it without limit via many distinct
// template strings. Templates are config-derived (small in practice); beyond the
// cap we simply recompile on miss instead of caching — correctness is unchanged.
var tmplCacheCount atomic.Int64

const tmplCacheCap = 4096

var badTemplate = &template.Template{}

// bareKeyRe matches a standalone {{ identifier }} action (no leading dot, no
// spaces inside the name) so we can rewrite it to {{ .identifier }}. Pipelines,
// dotted fields, and control actions ({{if ...}}) are left untouched.
var bareKeyRe = regexp.MustCompile(`{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}`)

// templateKeywords are the Go-template control words / built-ins that can appear
// as a bare {{word}} (or that we must not turn into a field reference). Without
// this guard the rewrite turns {{end}} into {{.end}}, breaking every
// {{if}}…{{end}} block in an action value (Slack message, webhook body, CRM
// field) and silently shipping the literal {{if}}.
var templateKeywords = map[string]bool{
	"if": true, "else": true, "end": true, "range": true, "with": true,
	"template": true, "define": true, "block": true, "break": true, "continue": true,
	"nil": true, "true": true, "false": true,
	"and": true, "or": true, "not": true, "eq": true, "ne": true,
	"lt": true, "le": true, "gt": true, "ge": true, "len": true, "index": true,
	"print": true, "printf": true, "println": true, "call": true,
}

// rewriteBareKeys turns {{field}} into {{.field}} but leaves template keywords
// ({{end}}, {{else}}, …) and helper-function names alone, so conditionals and
// pipelines survive in action templates.
func rewriteBareKeys(tmpl string) string {
	return bareKeyRe.ReplaceAllStringFunc(tmpl, func(m string) string {
		key := strings.TrimSpace(m[2 : len(m)-2])
		if templateKeywords[key] {
			return m
		}
		return "{{." + key + "}}"
	})
}

// renderOutboundURL renders a (possibly templated) outbound webhook URL and
// re-validates the result against the SSRF/HTTPS guard. A non-empty input that
// renders to empty is treated as a misconfiguration (error), not a silent skip.
func renderOutboundURL(raw string, data map[string]any) (string, error) {
	url := renderTemplate(raw, data)
	if url == "" {
		return "", fmt.Errorf("webhook url rendered empty")
	}
	if err := webhook.ValidateOutboundURL(url); err != nil {
		return "", fmt.Errorf("rendered webhook url failed validation: %w", err)
	}
	return url, nil
}

// renderTemplate renders tmpl against the event data map.
func renderTemplate(tmpl string, data map[string]any) string {
	if !strings.Contains(tmpl, "{{") {
		return strings.TrimSpace(tmpl)
	}
	t := compileTemplate(tmpl)
	if t == nil {
		return naiveRenderTemplate(tmpl, data)
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, flattenForTemplate(data)); err != nil {
		return naiveRenderTemplate(tmpl, data)
	}
	return strings.TrimSpace(buf.String())
}

func compileTemplate(tmpl string) *template.Template {
	if v, ok := tmplCache.Load(tmpl); ok {
		if v == badTemplate {
			return nil
		}
		return v.(*template.Template)
	}
	t, err := template.New("action").Funcs(exprFuncs).Option("missingkey=zero").Parse(rewriteBareKeys(tmpl))
	if err != nil {
		cacheStore(tmpl, badTemplate)
		return nil
	}
	cacheStore(tmpl, t)
	return t
}

// cacheStore stores a compiled template unless the cache is at capacity (a soft
// cap — a small overshoot under concurrency is fine; the point is bounded growth).
func cacheStore(tmpl string, t *template.Template) {
	if tmplCacheCount.Load() >= tmplCacheCap {
		return
	}
	if _, loaded := tmplCache.LoadOrStore(tmpl, t); !loaded {
		tmplCacheCount.Add(1)
	}
}

// flattenForTemplate renders every event-data value to a string so templates see
// a uniform map[string]string (dot access works; missing keys are "").
func flattenForTemplate(data map[string]any) map[string]string {
	out := make(map[string]string, len(data))
	for k, v := range data {
		out[k] = valueString(v)
	}
	return out
}

// naiveRenderTemplate is the original literal {{key}} substitution, used as a
// safe fallback when a template can't compile/execute.
func naiveRenderTemplate(tmpl string, data map[string]any) string {
	out := tmpl
	for {
		start := strings.Index(out, "{{")
		if start < 0 {
			break
		}
		end := strings.Index(out[start:], "}}")
		if end < 0 {
			break
		}
		end += start
		key := strings.TrimSpace(out[start+2 : end])
		key = strings.TrimPrefix(key, ".")
		out = out[:start] + stringFromMap(data, key) + out[end+2:]
	}
	return strings.TrimSpace(out)
}
