import './globals.css';

export const metadata = {
  title: 'CricManager — Cricket Tournament Manager',
  description: 'Personal cricket tournament management app. Create tournaments, record matches ball-by-ball, and track standings.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
      </head>
      <body>{children}</body>
    </html>
  );
}
