import { Link } from 'react-router'

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <p className="font-mono text-5xl font-bold text-indigo-600">404</p>
      <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        Fittingly, this is the same status code the REST API returns for an unknown resource.
      </p>
      <Link to="/" className="btn-primary mt-6">Back to the dashboard</Link>
    </div>
  )
}
