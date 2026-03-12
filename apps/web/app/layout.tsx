import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Visibility Scanner — AEO Auditing Platform',
  description: 'Measure and improve your AI visibility across ChatGPT, Google AI Overviews, Perplexity, and more.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
