export function SimpleTable({ columns, data, rowKey = "id" }) {
  return (
    <div className="overflow-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.accessor}
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-600"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white text-sm">
          {data.map((row) => (
            <tr key={row[rowKey] || Math.random()} className="transition-colors hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col.accessor} className="px-4 py-3 text-gray-700">
                  {col.cell ? col.cell(row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-gray-500">
                No records found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
