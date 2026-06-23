/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn, Download, Share2 } from "lucide-react";
import GlassCard from "./ui/GlassCard";

interface GalleryImage {
  id: string;
  url: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  category: "local" | "international" | "tracking" | "fleet" | "corporate" | "ecommerce" | "support";
}

const galleryImages: GalleryImage[] = [
  {
    id: "1",
    url: "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=800&q=80",
    titleAr: "توصيل محلي سريع",
    titleEn: "Swift Local Delivery",
    descriptionAr: "خدمة التوصيل داخل الإمارات بأسرع وقت",
    descriptionEn: "Fast delivery service within the UAE",
    category: "local"
  },
  {
    id: "2",
    url: "https://images.unsplash.com/photo-1578575437263-1cbd2fedbea1?w=800&q=80",
    titleAr: "شحن دولي موثوق",
    titleEn: "Reliable International Shipping",
    descriptionAr: "نقل شحناتك إلى جميع أنحاء العالم",
    descriptionEn: "Transporting your shipments worldwide",
    category: "international"
  },
  {
    id: "3",
    url: "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=800&q=80",
    titleAr: "تتبع مباشر للشحنات",
    titleEn: "Live Shipment Tracking",
    descriptionAr: "تابع شحنتك لحظة بلحظة",
    descriptionEn: "Track your shipment in real-time",
    category: "tracking"
  },
  {
    id: "4",
    url: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800&q=80",
    titleAr: "أسطول حديث",
    titleEn: "Modern Fleet",
    descriptionAr: "مركبات مجهزة لأعلى معايير الجودة",
    descriptionEn: "Vehicles equipped to highest standards",
    category: "fleet"
  },
  {
    id: "5",
    url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    titleAr: "حلول الشركات",
    titleEn: "Corporate Solutions",
    descriptionAr: "خدمات مخصصة للشركات والمؤسسات",
    descriptionEn: "Customized services for companies",
    category: "corporate"
  },
  {
    id: "6",
    url: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80",
    titleAr: "دعم المتاجر الإلكترونية",
    titleEn: "E-Commerce Support",
    descriptionAr: "حلول متكاملة للمتاجر онлайн",
    descriptionEn: "Integrated solutions for online stores",
    category: "ecommerce"
  },
  {
    id: "7",
    url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80",
    titleAr: "دعم 24/7",
    titleEn: "24/7 Support",
    descriptionAr: "فريق دعم متواجد على مدار الساعة",
    descriptionEn: "Support team available around the clock",
    category: "support"
  },
  {
    id: "8",
    url: "https://images.unsplash.com/photo-1566576912902-1d636658d297?w=800&q=80",
    titleAr: "تغليف آمن",
    titleEn: "Secure Packaging",
    descriptionAr: "حماية كاملة لشحناتك",
    descriptionEn: "Complete protection for your shipments",
    category: "local"
  }
];

const categories = [
  { key: "all", labelAr: "الكل", labelEn: "All" },
  { key: "local", labelAr: "محلي", labelEn: "Local" },
  { key: "international", labelAr: "دولي", labelEn: "International" },
  { key: "tracking", labelAr: "تتبع", labelEn: "Tracking" },
  { key: "fleet", labelAr: "أسطول", labelEn: "Fleet" },
  { key: "corporate", labelAr: "شركات", labelEn: "Corporate" },
  { key: "ecommerce", labelAr: "متاجر", labelEn: "E-Commerce" },
  { key: "support", labelAr: "دعم", labelEn: "Support" }
];

export default function Gallery() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [language, setLanguage] = useState<"ar" | "en">("ar");

  const filteredImages = selectedCategory === "all" 
    ? galleryImages 
    : galleryImages.filter(img => img.category === selectedCategory);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <span className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/20 rounded-full px-4 py-1.5 text-xs text-brand-gold font-bold uppercase tracking-widest">
          <ZoomIn className="w-4 h-4" />
          <span>{language === "ar" ? "معرض الصور" : "Photo Gallery"}</span>
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
          {language === "ar" ? "اكتشف خدماتنا بالصور" : "Discover Our Services Through Images"}
        </h2>
        <p className="text-white/60 text-sm max-w-2xl mx-auto">
          {language === "ar" 
            ? "جولة مصورة في خدمات داي نايت للتوصيل والشحن" 
            : "A visual tour of Day Night Delivery & Shipping services"}
        </p>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap justify-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedCategory === cat.key
                ? "bg-brand-gold text-brand-deep shadow-lg shadow-brand-gold/20"
                : "bg-brand-deep/50 text-white/60 hover:bg-brand-deep hover:text-white border border-white/10"
            }`}
          >
            {language === "ar" ? cat.labelAr : cat.labelEn}
          </button>
        ))}
      </div>

      {/* Language Toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-deep/50 border border-white/10 text-white/60 hover:text-white transition-all"
        >
          {language === "ar" ? "English" : "عربي"}
        </button>
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredImages.map((image) => (
          <motion.div
            key={image.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => setSelectedImage(image)}
            className="group cursor-pointer"
          >
            <GlassCard className="overflow-hidden p-0">
              <div className="aspect-[4/3] relative overflow-hidden">
                <img
                  src={image.url}
                  alt={language === "ar" ? image.titleAr : image.titleEn}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/90 via-brand-deep/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                  <h3 className="text-white font-bold text-sm">{language === "ar" ? image.titleAr : image.titleEn}</h3>
                  <p className="text-white/60 text-xs mt-1">{language === "ar" ? image.descriptionAr : image.descriptionEn}</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {filteredImages.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/40 text-sm">{language === "ar" ? "لا توجد صور في هذا التصنيف" : "No images in this category"}</p>
        </div>
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
              {/* Close Button */}
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-12 right-0 p-2 text-white/60 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Image */}
              <div className="rounded-2xl overflow-hidden mb-4">
                <img
                  src={selectedImage.url}
                  alt={language === "ar" ? selectedImage.titleAr : selectedImage.titleEn}
                  className="w-full h-auto max-h-[70vh] object-contain bg-brand-deep"
                />
              </div>

              {/* Info */}
              <GlassCard className="p-6 space-y-3">
                <h3 className="text-xl font-extrabold text-white">
                  {language === "ar" ? selectedImage.titleAr : selectedImage.titleEn}
                </h3>
                <p className="text-white/60 text-sm">
                  {language === "ar" ? selectedImage.descriptionAr : selectedImage.descriptionEn}
                </p>
                <div className="flex items-center gap-4 pt-4 border-t border-white/10">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-gold/10 text-brand-gold border border-brand-gold/20">
                    {categories.find(c => c.key === selectedImage.category)?.[language === "ar" ? "labelAr" : "labelEn"]}
                  </span>
                </div>
              </GlassCard>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
