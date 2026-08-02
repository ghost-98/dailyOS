export function LifeTabHeading({ description, title }: { description: string; title: string }) {
  return (
    <header className="life-tab-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}
