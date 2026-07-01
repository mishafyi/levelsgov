export function Footer() {
  return (
    <footer className="border-t bg-background py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <p>
            Data source:{" "}
            <a
              href="https://www.opm.gov/data/datasets/"
              className="underline hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              U.S. Office of Personnel Management — FedScope
            </a>
          </p>
          <p>
            LevelsGov is not affiliated with or endorsed by the U.S. government.
          </p>
        </div>
      </div>
    </footer>
  );
}
