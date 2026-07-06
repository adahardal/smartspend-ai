export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-40 rounded bg-gray-200" />
      <div className="mt-2 h-4 w-56 rounded bg-gray-200" />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-xl border bg-gray-100" />
        ))}
      </div>

      <div className="mt-6 h-72 rounded-xl border bg-gray-100" />
      <div className="mt-6 h-64 rounded-xl border bg-gray-100" />
    </div>
  );
}
