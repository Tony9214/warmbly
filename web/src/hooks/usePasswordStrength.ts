import { useCallback, useRef, useState } from "react";

type ZxcvbnResult = {
    score: 0 | 1 | 2 | 3 | 4;
    feedback: { warning: string; suggestions: string[] };
};

type StrengthResult = {
    score: 0 | 1 | 2 | 3 | 4;
    warning: string;
    suggestions: string[];
};

const empty: StrengthResult = { score: 0, warning: "", suggestions: [] };

export function usePasswordStrength() {
    const zxcvbnRef = useRef<((pw: string) => ZxcvbnResult) | null>(null);
    const [loading, setLoading] = useState(false);

    const evaluate = useCallback(async (password: string): Promise<StrengthResult> => {
        if (!password) return empty;

        if (!zxcvbnRef.current) {
            setLoading(true);
            const [{ zxcvbn, zxcvbnOptions }, common, en] = await Promise.all([
                import("@zxcvbn-ts/core"),
                import("@zxcvbn-ts/language-common"),
                import("@zxcvbn-ts/language-en"),
            ]);
            zxcvbnOptions.setOptions({
                translations: en.translations,
                graphs: common.adjacencyGraphs,
                dictionary: {
                    ...common.dictionary,
                    ...en.dictionary,
                },
            });
            zxcvbnRef.current = zxcvbn;
            setLoading(false);
        }

        const result = zxcvbnRef.current(password);
        return {
            score: result.score,
            warning: result.feedback.warning,
            suggestions: result.feedback.suggestions,
        };
    }, []);

    return { evaluate, loading };
}
