import Link from "next/link";

export function Logo({ size = "md", linked = true }: { size?: "sm" | "md" | "lg"; linked?: boolean }) {
  const sizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  const dotSizes = {
    sm: "w-1 h-1",
    md: "w-1.5 h-1.5",
    lg: "w-2.5 h-2.5",
  };

  const content = (
    <span
      className={`font-medium tracking-wide ${sizes[size]} inline-flex items-baseline`}
      style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
    >
      W
      <span className={`${dotSizes[size]} rounded-full inline-block mx-[0.05em] relative -bottom-[0.05em]`} style={{ backgroundColor: "var(--peach)" }} />
      H
      <span className={`${dotSizes[size]} rounded-full inline-block mx-[0.05em] relative -bottom-[0.05em]`} style={{ backgroundColor: "var(--seafoam)" }} />
      Y
      <span className={`${dotSizes[size]} rounded-full inline-block mx-[0.05em] relative -bottom-[0.05em]`} style={{ backgroundColor: "var(--sunshine)" }} />
    </span>
  );

  if (linked) {
    return <Link href="/" className="hover:opacity-80 transition-opacity">{content}</Link>;
  }

  return content;
}
