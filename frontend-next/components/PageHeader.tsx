interface Props {
  title: string;
  subtitle?: string;
}

export default function PageHeader({ title, subtitle }: Props) {
  return (
    <div className="mb-8">
      <h1 className="font-serif text-3xl lg:text-4xl font-bold text-white tracking-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="text-[#7a8f82] text-sm mt-1.5 max-w-xl">{subtitle}</p>
      )}
    </div>
  );
}
