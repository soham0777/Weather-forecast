import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import ApiDocs from './pages/ApiDocs'
import ApiLogs from './pages/ApiLogs'
import Architecture from './pages/Architecture'
import Comparison from './pages/Comparison'
import Dashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'
import RestPlayground from './pages/RestPlayground'
import SoapSimulator from './pages/SoapSimulator'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="rest" element={<RestPlayground />} />
        <Route path="soap" element={<SoapSimulator />} />
        <Route path="architecture" element={<Architecture />} />
        <Route path="comparison" element={<Comparison />} />
        <Route path="docs" element={<ApiDocs />} />
        <Route path="logs" element={<ApiLogs />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
