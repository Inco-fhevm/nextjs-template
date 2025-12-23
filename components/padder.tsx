const Padder = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-slate-100 min-h-screen text-neutral-800">
      <div className="px-4 py-8 mx-auto max-w-7xl">{children}</div>
    </div>
  );
};

export default Padder;
