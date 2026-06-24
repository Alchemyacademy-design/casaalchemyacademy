import { Label } from "@/components/ui/label";

type Option = { id: number; option_text: string };

type Props = {
  questionText: string;
  options: ReadonlyArray<Option>;
  selectedOptionId: number | null;
  disabled?: boolean;
  onChange: (optionId: number) => void;
  /** When the quiz is graded we may show correctness next to each option. */
  reveal?: { correctOptionId: number | null };
  explanation?: string | null;
};

const letter = (i: number) => String.fromCharCode(65 + i);

export default function QuizQuestion({
  questionText,
  options,
  selectedOptionId,
  disabled,
  onChange,
  reveal,
  explanation,
}: Props) {
  return (
    <div className="space-y-3">
      <h3 className="font-serif text-xl text-foreground">{questionText}</h3>
      <div role="radiogroup" aria-label={questionText} className="space-y-2">
        {options.map((opt, i) => {
          const isSelected = selectedOptionId === opt.id;
          const isCorrect = reveal?.correctOptionId === opt.id;
          const isWrongChoice = reveal && isSelected && reveal.correctOptionId !== opt.id;
          const tone =
            reveal == null
              ? isSelected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-foreground/40"
              : isCorrect
                ? "border-emerald-500 bg-emerald-500/10"
                : isWrongChoice
                  ? "border-destructive bg-destructive/10"
                  : "border-border";
          return (
            <Label
              key={opt.id}
              className={`flex items-start gap-3 cursor-pointer rounded-md border p-3 transition ${tone} ${
                disabled ? "pointer-events-none opacity-90" : ""
              }`}
            >
              <input
                type="radio"
                className="mt-1"
                name={`q-${opt.id}`}
                checked={isSelected}
                disabled={disabled}
                onChange={() => onChange(opt.id)}
                aria-label={`${letter(i)}: ${opt.option_text}`}
              />
              <span className="text-sm text-foreground/85">
                <span className="font-mono mr-2 text-foreground/60">{letter(i)}.</span>
                {opt.option_text}
              </span>
            </Label>
          );
        })}
      </div>
      {reveal && explanation && (
        <p className="text-xs text-foreground/70 italic border-l-2 border-border pl-3">
          {explanation}
        </p>
      )}
    </div>
  );
}
