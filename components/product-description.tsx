import type { ReactNode } from 'react';

function formatInline(value: string, keyPrefix: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={`${keyPrefix}-${index}`}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export default function ProductDescription({ value }: { value: string }) {
  const lines = value.split(/\r?\n/);
  const content: ReactNode[] = [];
  let listItems: string[] = [];
  const flushList = () => {
    if (!listItems.length) return;
    content.push(<ul key={`list-${content.length}`} className="list-disc space-y-1 pl-5">{listItems.map((item, index) => <li key={index}>{formatInline(item, `list-${index}`)}</li>)}</ul>);
    listItems = [];
  };
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      listItems.push(trimmed.slice(2));
      return;
    }
    flushList();
    if (!trimmed) return;
    if (trimmed.startsWith('## ')) content.push(<h4 key={`heading-${index}`} className="font-bold text-stone-800">{formatInline(trimmed.slice(3), `heading-${index}`)}</h4>);
    else content.push(<p key={`paragraph-${index}`}>{formatInline(trimmed, `paragraph-${index}`)}</p>);
  });
  flushList();
  return <div className="space-y-2 leading-relaxed">{content}</div>;
}
