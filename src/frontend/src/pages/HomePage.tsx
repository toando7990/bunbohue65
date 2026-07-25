import { CustomerLayout } from "@/Layout";
import { JsonLd } from "@/components/JsonLd";
import { useLanguage } from "@/i18n";
import { QrCode, Truck } from "lucide-react";
import { motion } from "motion/react";
import { Helmet } from "react-helmet-async";

export default function HomePage() {
  const { t } = useLanguage();

  const STEPS = [
    { emoji: "📷", label: t.home.steps.scan.title },
    { emoji: "🍽️", label: t.home.steps.choose.title },
    { emoji: "✅", label: t.home.steps.enjoy.title },
  ];

  const localBusinessSchema: object = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "FoodEstablishment"],
    name: "Bún Bò Huế 65",
    url: "https://www.bunbohue65.vn",
    image: "https://www.bunbohue65.vn/favicon.ico",
    servesCuisine: ["Bún Bò Huế", "Ẩm thực Huế", "Vietnamese"],
    hasMap: "https://www.bunbohue65.vn/delivery",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Hà Nội",
      addressRegion: "Hà Nội",
      addressCountry: "VN",
    },
  };

  const webSiteSchema: object = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Bún Bò Huế 65",
    url: "https://www.bunbohue65.vn",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate:
          "https://www.bunbohue65.vn/delivery?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };

  const organizationSchema: object = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Bún Bò Huế 65",
    url: "https://www.bunbohue65.vn",
    logo: "https://www.bunbohue65.vn/favicon.ico",
  };

  return (
    <CustomerLayout>
      <Helmet>
        <title>Bún Bò Huế 65 - Đặt món trực tuyến</title>
        <meta
          name="description"
          content="Đặt món Bún Bò Huế online - giao hàng tận nơi, nhanh chóng và tiện lợi tại Huế"
        />
        <link rel="canonical" href="https://www.bunbohue65.vn/" />
        <meta property="og:url" content="https://www.bunbohue65.vn/" />
        <meta
          property="og:title"
          content="Bún Bò Huế 65 - Đặt món trực tuyến"
        />
        <meta
          property="og:description"
          content="Đặt món Bún Bò Huế online - giao hàng tận nơi, nhanh chóng và tiện lợi"
        />
        <meta property="og:type" content="website" />
      </Helmet>
      <JsonLd
        schema={[localBusinessSchema, webSiteSchema, organizationSchema]}
      />
      <div
        data-ocid="home.page"
        className="flex flex-col items-center justify-center gap-0 text-center"
      >
        {/* Hero image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-lg mx-auto overflow-hidden rounded-2xl shadow-lg mb-8 mt-2"
        >
          <img
            src="/assets/generated/restaurant-hero.dim_800x600.jpg"
            alt={t.home.hero.title}
            className="w-full object-cover h-64 sm:h-80"
          />
        </motion.div>

        {/* QR Icon badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-5"
        >
          <QrCode className="w-8 h-8 text-primary" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="font-display text-4xl sm:text-5xl italic text-foreground mb-3"
        >
          {t.home.hero.title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-muted-foreground text-base sm:text-lg max-w-xs leading-relaxed"
        >
          {t.home.hero.subtitle}
        </motion.p>

        {/* Divider */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="w-16 h-px bg-border my-8"
        />

        {/* Steps */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="grid grid-cols-3 gap-4 max-w-sm w-full"
        >
          {STEPS.map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 + i * 0.1, duration: 0.4 }}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border shadow-sm"
            >
              <span className="text-2xl">{step.emoji}</span>
              <span className="text-xs text-muted-foreground text-center leading-tight">
                {step.label}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Staff hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.4 }}
          className="mt-10 text-xs text-muted-foreground flex items-center gap-1.5"
        >
          <Truck className="w-3.5 h-3.5" />
          <span>
            {t.nav.admin}?{" "}
            <a
              href="/admin"
              className="underline hover:text-foreground transition-colors"
              data-ocid="home.admin_link"
            >
              {t.adminLogin.signInButton}
            </a>
          </span>
        </motion.div>
      </div>
    </CustomerLayout>
  );
}
