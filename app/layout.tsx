import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "./components/PostHogProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "We Hear You",
  description: "Insights, personas, mood, themes, and sentiment, all from a user\u2019s video.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "We Hear You",
    description: "Insights, personas, mood, themes, and sentiment, all from a user\u2019s video.",
    url: "https://app.wehearyou.io",
    siteName: "We Hear You",
    images: [
      {
        url: "https://app.wehearyou.io/og-image.png",
        width: 1200,
        height: 630,
        alt: "We Hear You — Insights, personas, mood, themes, and sentiment, all from a user\u2019s video.",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "We Hear You",
    description: "Insights, personas, mood, themes, and sentiment, all from a user\u2019s video.",
    images: ["https://app.wehearyou.io/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("why-theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} antialiased`}
      >
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
