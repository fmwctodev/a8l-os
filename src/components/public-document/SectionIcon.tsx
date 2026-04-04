import {
  FileText,
  List,
  Package,
  CalendarDays,
  DollarSign,
  Shield,
  Lock,
  XCircle,
  AlertTriangle,
  Scale,
  Landmark,
  PenTool,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  intro: FileText,
  scope: List,
  deliverables: Package,
  timeline: CalendarDays,
  pricing: DollarSign,
  terms: Shield,
  custom: FileText,
  payment_terms: DollarSign,
  intellectual_property: Shield,
  confidentiality: Lock,
  termination: XCircle,
  liability: AlertTriangle,
  dispute_resolution: Scale,
  governing_law: Landmark,
  general_provisions: FileText,
  signatures: PenTool,
};

interface SectionIconProps {
  sectionType: string;
  className?: string;
}

export function SectionIcon({ sectionType, className = 'w-5 h-5' }: SectionIconProps) {
  const Icon = ICON_MAP[sectionType] || FileText;
  return <Icon className={className} />;
}
