export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 animate-pulse">
      <div className="xl:col-span-8 space-y-4 sm:space-y-6">
        <div className="card h-32" />
        <div className="card h-24" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="card h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="card h-72" />
          <div className="card h-72" />
        </div>
        <div className="card h-48" />
      </div>
      <aside className="xl:col-span-4 space-y-4 sm:space-y-6">
        <div className="card h-24" />
        <div className="card h-48" />
        <div className="card h-32" />
      </aside>
    </div>
  );
}
