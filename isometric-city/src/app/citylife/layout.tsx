import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'CityLife — Connected Life Planning' },
  description:
    'Map commitments as a city, connect them with support pathways, and compare Income, Happiness, and Wellness planning signals.',
  applicationName: 'CityLife',
  openGraph: {
    title: 'CityLife — Connected Life Planning',
    description:
      'A local-first visual planning tool for mapping commitments, support pathways, and life-balance tradeoffs.',
    type: 'website',
    siteName: 'CityLife',
  },
  twitter: {
    card: 'summary',
    title: 'CityLife — Connected Life Planning',
    description:
      'A local-first visual planning tool for mapping commitments, support pathways, and life-balance tradeoffs.',
  },
};

export default function CityLifeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
