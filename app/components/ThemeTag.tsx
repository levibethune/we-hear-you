export function ThemeTag({ theme }: { theme: string }) {
  return (
    <span className="inline-block text-xs bg-seafoam/10 text-seafoam px-2.5 py-0.5 rounded-full">
      {theme}
    </span>
  );
}
