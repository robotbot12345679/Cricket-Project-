import './globals.css';

export const metadata = {
  title: 'CricManager — Cricket Tournament Manager',
  description: 'Personal cricket tournament management app. Create tournaments, record matches ball-by-ball, and track standings.',
};

import ThemeProvider from '@/components/ThemeProvider';

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
