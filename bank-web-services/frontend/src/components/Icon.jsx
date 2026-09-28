import {
  ArrowLeftRight, Braces, Building2, Cpu, CreditCard, Database, FileCode, Globe, History, Lock, ScrollText,
  Smartphone, Wallet, Zap,
} from 'lucide-react'

// Data files refer to icons by name; this keeps the import list explicit (and tree-shakeable).
const ICONS = {
  ArrowLeftRight, Braces, Building2, Cpu, CreditCard, Database, FileCode, Globe, History, Lock, ScrollText,
  Smartphone, Wallet, Zap,
}

export default function Icon({ name, ...props }) {
  const Component = ICONS[name] || Braces
  return <Component aria-hidden="true" {...props} />
}
