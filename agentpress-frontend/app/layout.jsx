import './globals.css';

export const metadata = {
  title: 'AgentPress — Build and deploy AI agents for small business, on X Layer',
  description: 'A developer console for building AI agents for small businesses, deployed to the OKX AI Marketplace on X Layer.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
