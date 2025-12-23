const Padder = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen">
      <div className="px-4 py-8 mx-auto max-w-7xl">{children}</div>
    </div>
  );
};

export default Padder;
