import React, { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  Download,
  Share2,
  Heart,
  Truck,
  Globe,
  Camera,
  MapPin,
  Package,
  Phone,
  Mail,
} from "lucide-react";
import { useAppContext } from "../../lib/AppContext";
import { translations } from "../../data/translations";
import companyMeta from "../../data/companyMeta";

const galleryData = {
  categories: [
    {
      id: "fleet",
      icon: Truck,
      images: [
        "https://i.postimg.cc/vZSPgbDV/Chat-GPT-Image-22-ywnyw-2026-03-28-22-m.png",
        "https://i.postimg.cc/gkstpvpP/Chat-GPT-Image-22-ywnyw-2026-03-36-29-m-(1).png",
        "https://i.postimg.cc/rFjZTST6/Chat-GPT-Image-22-ywnyw-2026-03-36-29-m-(3).png",
        "https://i.postimg.cc/kXsYCxC3/Chat-GPT-Image-22-ywnyw-2026-03-36-30-m-(4).png",
        "https://i.postimg.cc/J4xY8bLS/Chat-GPT-Image-22-ywnyw-2026-03-36-30-m-(5).png",
        "https://i.postimg.cc/tCkvbhjf/Chat-GPT-Image-22-ywnyw-2026-03-36-31-m-(6).png",
        "https://i.postimg.cc/4NP2Gzg0/Chat-GPT-Image-22-ywnyw-2026-03-36-32-m-(7).png",
        "https://i.postimg.cc/wT24zhpb/Chat-GPT-Image-22-ywnyw-2026-03-36-32-m-(8).png",
        "https://i.postimg.cc/FspCvj4T/Chat-GPT-Image-22-ywnyw-2026-03-36-33-m-(10).png",
        "https://i.postimg.cc/ZKHsmrSf/Chat-GPT-Image-22-ywnyw-2026-03-36-33-m-(9).png",
      ],
    },
    {
      id: "delivery",
      icon: Package,
      images: [
        "https://i.postimg.cc/7Y9t4gkm/Chat-GPT-Image-22-ywnyw-2026-03-41-36-m-(1).png",
        "https://i.postimg.cc/02nXvpsf/Chat-GPT-Image-22-ywnyw-2026-03-41-36-m-(2).png",
        "https://i.postimg.cc/wT24zhpc/Chat-GPT-Image-22-ywnyw-2026-03-41-37-m-(3).png",
        "https://i.postimg.cc/wT24zhpD/Chat-GPT-Image-22-ywnyw-2026-03-41-37-m-(4).png",
        "https://i.postimg.cc/MK53wySB/Chat-GPT-Image-22-ywnyw-2026-03-41-37-m-(5).png",
        "https://i.postimg.cc/gkstpvWR/Chat-GPT-Image-22-ywnyw-2026-03-41-38-m-(6).png",
        "https://i.postimg.cc/m2BpKm0w/Chat-GPT-Image-22-ywnyw-2026-03-41-38-m-(7).png",
        "https://i.postimg.cc/wTg4nwSQ/Chat-GPT-Image-22-ywnyw-2026-03-41-40-m-(8).png",
        "https://i.postimg.cc/28r9g0PF/Chat-GPT-Image-22-ywnyw-2026-03-41-40-m-(9).png",
        "https://i.postimg.cc/sDsHbTt5/Chat-GPT-Image-22-ywnyw-2026-03-41-41-m-(10).png",
      ],
    },
    {
      id: "tracking",
      icon: Globe,
      images: [
        "https://i.postimg.cc/j2ZHp473/Chat-GPT-Image-22-ywnyw-2026-04-38-36-m-(1).png",
        "https://i.postimg.cc/4yB6DQ98/Chat-GPT-Image-22-ywnyw-2026-04-38-36-m-(2).png",
        "https://i.postimg.cc/sxwYk4hp/Chat-GPT-Image-22-ywnyw-2026-04-38-36-m-(3).png",
        "https://i.postimg.cc/prqfwJFK/Chat-GPT-Image-22-ywnyw-2026-04-38-36-m-(4).png",
        "https://i.postimg.cc/SRD6BfM9/Chat-GPT-Image-22-ywnyw-2026-04-38-36-m-(5).png",
        "https://i.postimg.cc/prqfwJFn/Chat-GPT-Image-22-ywnyw-2026-04-38-36-m-(6).png",
        "https://i.postimg.cc/D0Br9PXS/Chat-GPT-Image-22-ywnyw-2026-04-38-36-m-(7).png",
        "https://i.postimg.cc/KjJP6DMj/Chat-GPT-Image-22-ywnyw-2026-04-38-36-m-(8).png",
        "https://i.postimg.cc/0jcYT0wQ/Chat-GPT-Image-22-ywnyw-2026-04-38-36-m-(9).png",
        "https://i.postimg.cc/3NnXsFvJ/Chat-GPT-Image-22-ywnyw-2026-04-38-37-m-(10).png",
        "https://i.postimg.cc/SRyL1vJ0/Chat-GPT-Image-22-ywnyw-2026-04-41-41-m-(1).png",
        "https://i.postimg.cc/761MVkPW/Chat-GPT-Image-22-ywnyw-2026-04-41-41-m-(10).png",
        "https://i.postimg.cc/0j8GXBrh/Chat-GPT-Image-22-ywnyw-2026-04-41-41-m-(2).png",
        "https://i.postimg.cc/wM654G3P/Chat-GPT-Image-22-ywnyw-2026-04-41-41-m-(3).png",
        "https://i.postimg.cc/Bbq57Vtw/Chat-GPT-Image-22-ywnyw-2026-04-41-41-m-(4).png",
        "https://i.postimg.cc/j56QXbdb/Chat-GPT-Image-22-ywnyw-2026-04-41-41-m-(5).png",
        "https://i.postimg.cc/26dFwD8N/Chat-GPT-Image-22-ywnyw-2026-04-41-41-m-(6).png",
        "https://i.postimg.cc/85dBHSP8/Chat-GPT-Image-22-ywnyw-2026-04-41-41-m-(7).png",
        "https://i.postimg.cc/3RjCBTrs/Chat-GPT-Image-22-ywnyw-2026-04-41-41-m-(8).png",
        "https://i.postimg.cc/sXP9crfL/Chat-GPT-Image-22-ywnyw-2026-04-41-41-m-(9).png",
        "https://i.postimg.cc/d1RmBYQN/Chat-GPT-Image-22-ywnyw-2026-04-43-42-m-(1).png",
        "https://i.postimg.cc/fL7jKNW9/Chat-GPT-Image-22-ywnyw-2026-04-43-43-m-(10).png",
        "https://i.postimg.cc/d1RmBYQ5/Chat-GPT-Image-22-ywnyw-2026-04-43-43-m-(2).png",
        "https://i.postimg.cc/xCGyR2jt/Chat-GPT-Image-22-ywnyw-2026-04-43-43-m-(3).png",
        "https://i.postimg.cc/LXkBTp4v/Chat-GPT-Image-22-ywnyw-2026-04-43-43-m-(4).png",
        "https://i.postimg.cc/Pxbz4jf4/Chat-GPT-Image-22-ywnyw-2026-04-43-43-m-(5).png",
        "https://i.postimg.cc/SsL7rhQf/Chat-GPT-Image-22-ywnyw-2026-04-43-43-m-(6).png",
        "https://i.postimg.cc/Kz7rN2cr/Chat-GPT-Image-22-ywnyw-2026-04-43-43-m-(7).png",
        "https://i.postimg.cc/Hx042gWQ/Chat-GPT-Image-22-ywnyw-2026-04-43-43-m-(8).png",
        "https://i.postimg.cc/V69BR8st/Chat-GPT-Image-22-ywnyw-2026-04-43-43-m-(9).png",
        "https://i.postimg.cc/SsL7rhQz/Chat-GPT-Image-22-ywnyw-2026-04-45-11-m-(1).png",
        "https://i.postimg.cc/nzfGBzxF/Chat-GPT-Image-22-ywnyw-2026-04-45-11-m-(10).png",
        "https://i.postimg.cc/JnC5Zn8c/Chat-GPT-Image-22-ywnyw-2026-04-45-11-m-(2).png",
        "https://i.postimg.cc/zBYFKBNC/Chat-GPT-Image-22-ywnyw-2026-04-45-11-m-(3).png",
        "https://i.postimg.cc/qRHxyRr8/Chat-GPT-Image-22-ywnyw-2026-04-45-11-m-(4).png",
        "https://i.postimg.cc/tTGNWTbW/Chat-GPT-Image-22-ywnyw-2026-04-45-11-m-(5).png",
        "https://i.postimg.cc/gJbH8JpZ/Chat-GPT-Image-22-ywnyw-2026-04-45-11-m-(6).png",
        "https://i.postimg.cc/ZRzxpRmv/Chat-GPT-Image-22-ywnyw-2026-04-45-11-m-(7).png",
        "https://i.postimg.cc/hjR1TjnJ/Chat-GPT-Image-22-ywnyw-2026-04-45-11-m-(8).png",
        "https://i.postimg.cc/G2nxG2Rp/Chat-GPT-Image-22-ywnyw-2026-04-45-11-m-(9).png",
        "https://i.postimg.cc/J013Y2GH/Chat-GPT-Image-22-ywnyw-2026-04-50-40-m-(1).png",
        "https://i.postimg.cc/2yzd9KVb/Chat-GPT-Image-22-ywnyw-2026-04-50-40-m-(2).png",
        "https://i.postimg.cc/qqkcD5zd/Chat-GPT-Image-22-ywnyw-2026-04-50-41-m-(10).png",
        "https://i.postimg.cc/7hx1tWff/Chat-GPT-Image-22-ywnyw-2026-04-50-41-m-(3).png",
        "https://i.postimg.cc/Wz2mYHhd/Chat-GPT-Image-22-ywnyw-2026-04-50-41-m-(4).png",
        "https://i.postimg.cc/gjYytTn0/Chat-GPT-Image-22-ywnyw-2026-04-50-41-m-(5).png",
        "https://i.postimg.cc/QCXgYyHx/Chat-GPT-Image-22-ywnyw-2026-04-50-41-m-(6).png",
        "https://i.postimg.cc/MHW03Fvz/Chat-GPT-Image-22-ywnyw-2026-04-50-41-m-(7).png",
        "https://i.postimg.cc/SRyL1vJS/Chat-GPT-Image-22-ywnyw-2026-04-50-41-m-(8).png",
        "https://i.postimg.cc/PJtbVRPj/Chat-GPT-Image-22-ywnyw-2026-04-50-41-m-(9).png",
        "https://i.postimg.cc/8C6b7v2z/Chat-GPT-Image-22-ywnyw-2026-04-53-19-m-(1).png",
        "https://i.postimg.cc/1zqK8Fk5/Chat-GPT-Image-22-ywnyw-2026-04-53-19-m-(2).png",
        "https://i.postimg.cc/bvtRZn7y/Chat-GPT-Image-22-ywnyw-2026-04-53-19-m-(3).png",
        "https://i.postimg.cc/3wvZkGsK/Chat-GPT-Image-22-ywnyw-2026-04-53-19-m-(4).png",
        "https://i.postimg.cc/rpr9D4vZ/Chat-GPT-Image-22-ywnyw-2026-04-53-20-m-(10).png",
        "https://i.postimg.cc/FKLxYSMX/Chat-GPT-Image-22-ywnyw-2026-04-53-20-m-(5).png",
        "https://i.postimg.cc/SKMGn9wB/Chat-GPT-Image-22-ywnyw-2026-04-53-20-m-(6).png",
        "https://i.postimg.cc/pdFBmjg4/Chat-GPT-Image-22-ywnyw-2026-04-53-20-m-(7).png",
        "https://i.postimg.cc/nLD1Xm6P/Chat-GPT-Image-22-ywnyw-2026-04-53-20-m-(8).png",
        "https://i.postimg.cc/CKq4R8W6/Chat-GPT-Image-22-ywnyw-2026-04-53-20-m-(9).png",
        "https://i.postimg.cc/N0HxKXWJ/Chat-GPT-Image-22-ywnyw-2026-04-54-42-m-(1).png",
        "https://i.postimg.cc/t4f5RkmD/Chat-GPT-Image-22-ywnyw-2026-04-54-42-m-(10).png",
        "https://i.postimg.cc/7L2N5zpB/Chat-GPT-Image-22-ywnyw-2026-04-54-42-m-(2).png",
        "https://i.postimg.cc/hGd0XmHp/Chat-GPT-Image-22-ywnyw-2026-04-54-42-m-(3).png",
        "https://i.postimg.cc/KYM51TdQ/Chat-GPT-Image-22-ywnyw-2026-04-54-42-m-(4).png",
        "https://i.postimg.cc/25Zx1WPG/Chat-GPT-Image-22-ywnyw-2026-04-54-42-m-(5).png",
        "https://i.postimg.cc/XYh8NLDt/Chat-GPT-Image-22-ywnyw-2026-04-54-42-m-(6).png",
        "https://i.postimg.cc/W1Knp8fK/Chat-GPT-Image-22-ywnyw-2026-04-54-42-m-(7).png",
        "https://i.postimg.cc/zGMjD7PQ/Chat-GPT-Image-22-ywnyw-2026-04-54-42-m-(8).png",
        "https://i.postimg.cc/2SJwjGXM/Chat-GPT-Image-22-ywnyw-2026-04-54-42-m-(9).png",
        "https://i.postimg.cc/brz0VBsc/Chat-GPT-Image-22-ywnyw-2026-09-36-09-m.png",
      ],
    },
    {
      id: "premium",
      icon: Camera,
      images: [
        "https://i.postimg.cc/Z5DfB40v/Chat-GPT-Image-22-ywnyw-2026-04-50-31-m.png",
        "https://i.postimg.cc/wTg4nwSL/Chat-GPT-Image-22-ywnyw-2026-04-52-05-m-(1).png",
        "https://i.postimg.cc/VsjH7xHQ/Chat-GPT-Image-22-ywnyw-2026-04-52-05-m-(10).png",
        "https://i.postimg.cc/TYfNBtZb/Chat-GPT-Image-22-ywnyw-2026-04-52-05-m-(2).png",
        "https://i.postimg.cc/xTnpB6Wz/Chat-GPT-Image-22-ywnyw-2026-04-52-05-m-(3).png",
        "https://i.postimg.cc/YqMDTdJG/Chat-GPT-Image-22-ywnyw-2026-04-52-05-m-(4).png",
        "https://i.postimg.cc/kXqYLTk2/Chat-GPT-Image-22-ywnyw-2026-04-52-05-m-(5).png",
        "https://i.postimg.cc/rFMZ7fvs/Chat-GPT-Image-22-ywnyw-2026-04-52-05-m-(6).png",
        "https://i.postimg.cc/fTDq186T/Chat-GPT-Image-22-ywnyw-2026-04-52-05-m-(7).png",
        "https://i.postimg.cc/wxhbWCb9/Chat-GPT-Image-22-ywnyw-2026-04-52-05-m-(8).png",
        "https://i.postimg.cc/y6FrfMrz/Chat-GPT-Image-22-ywnyw-2026-04-52-05-m-(9).png",
      ],
    },
    {
      id: "branding",
      icon: MapPin,
      images: [
        "https://i.postimg.cc/59wkPhK7/Chat-GPT-Image-22-ywnyw-2026-09-35-56-m-(1).png",
        "https://i.postimg.cc/JzdTDMtD/Chat-GPT-Image-22-ywnyw-2026-09-35-56-m-(2).png",
        "https://i.postimg.cc/BbcYXFPd/Chat-GPT-Image-Jun-12-2026-02-14-10-PM.png",
        "https://i.postimg.cc/zvStVhRK/Chat-GPT-Image-Jun-12-2026-02-14-15-PM.png",
        "https://i.postimg.cc/Ss9tb3ST/Chat-GPT-Image-Jun-12-2026-02-14-36-PM.png",
        "https://i.postimg.cc/Cx6vBSdZ/Chat-GPT-Image-Jun-19-2026-12-03-15-AM.png",
        "https://i.postimg.cc/x8yxcmbm/Chat-GPT-Image-Jun-19-2026-12-03-21-AM.png",
        "https://i.postimg.cc/x1FsJnqc/Chat-GPT-Image-Jun-19-2026-12-03-25-AM.png",
        "https://i.postimg.cc/Cx6vBSdK/Chat-GPT-Image-Jun-19-2026-12-03-27-AM.png",
        "https://i.postimg.cc/Nj0Jj5Gr/Chat-GPT-Image-Jun-19-2026-12-03-30-AM.png",
        "https://i.postimg.cc/cL5Dg06x/Chat-GPT-Image-Jun-19-2026-12-03-34-AM.png",
        "https://i.postimg.cc/g20S2ncw/Chat-GPT-Image-Jun-19-2026-12-03-37-AM.png",
        "https://i.postimg.cc/y8NQ8k6x/Chat-GPT-Image-Jun-19-2026-12-03-40-AM.png",
        "https://i.postimg.cc/Nj0Jj5G0/Chat-GPT-Image-Jun-19-2026-12-03-42-AM.png",
        "https://i.postimg.cc/3xwSxd8V/Chat-GPT-Image-Jun-19-2026-12-03-45-AM.png",
        "https://i.postimg.cc/rwpnwKyw/Chat-GPT-Image-Jun-19-2026-12-03-48-AM.png",
        "https://i.postimg.cc/nhLRhCVV/Chat-GPT-Image-Jun-19-2026-12-04-07-AM.png",
        "https://i.postimg.cc/3xwSxdrJ/Chat-GPT-Image-Jun-19-2026-12-04-10-AM.png",
        "https://i.postimg.cc/9Qf8QrXV/Chat-GPT-Image-Jun-19-2026-12-04-13-AM.png",
        "https://i.postimg.cc/1XcCfFND/Chat-GPT-Image-Jun-19-2026-12-04-19-AM.png",
        "https://i.postimg.cc/dV0HVLQY/Chat-GPT-Image-Jun-19-2026-12-04-22-AM.png",
        "https://i.postimg.cc/kg51gBJh/Chat-GPT-Image-Jun-19-2026-12-04-28-AM.png",
        "https://i.postimg.cc/Z5q75Cbs/Chat-GPT-Image-Jun-19-2026-12-04-31-AM.png",
        "https://i.postimg.cc/fTCqsxsN/Chat-GPT-Image-Jun-19-2026-12-04-35-AM.png",
        "https://i.postimg.cc/VLgZwjwP/Chat-GPT-Image-Jun-19-2026-12-04-43-AM.png",
        "https://i.postimg.cc/bwvCwsyM/Chat-GPT-Image-Jun-19-2026-12-04-47-AM.png",
        "https://i.postimg.cc/Dwzjw8f3/Chat-GPT-Image-Jun-19-2026-12-04-53-AM.png",
        "https://i.postimg.cc/gcvBMCt5/Chat-GPT-Image-Jun-19-2026-12-05-05-AM.png",
        "https://i.postimg.cc/bwvCwsYj/Chat-GPT-Image-Jun-19-2026-12-05-10-AM.png",
        "https://i.postimg.cc/3xwSxdrM/Chat-GPT-Image-Jun-19-2026-12-05-13-AM.png",
        "https://i.postimg.cc/mgrXgtLv/Chat-GPT-Image-Jun-19-2026-12-11-44-AM.png",
      ],
    },
  ],
};

export default function UltimateGalleryV2() {
  const { language, theme } = useAppContext();
  const t = translations[language];
  const tg = t.gallery;
  const isLight = theme === "light";
  const isArabic = language === "ar";

  const [selectedCategory, setSelectedCategory] = useState(galleryData.categories[0]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [likedImages, setLikedImages] = useState<Set<string>>(new Set());
  const galleryRef = useRef<HTMLDivElement>(null);

  const currentImages = selectedCategory.images;

  const categoryLabels: Record<string, string> = {
    fleet: tg.fleet,
    delivery: tg.delivery,
    tracking: tg.tracking,
    premium: tg.premium,
    branding: tg.branding,
  };

  const handleImageClick = (image: string, index: number) => {
    setSelectedImage(image);
    setCurrentImageIndex(index);
    setIsZoomed(false);
  };

  const handleCloseLightbox = () => {
    setSelectedImage(null);
    setIsZoomed(false);
  };

  const handlePrev = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? currentImages.length - 1 : prev - 1));
    setSelectedImage(currentImages[(currentImageIndex - 1 + currentImages.length) % currentImages.length]);
  };

  const handleNext = () => {
    setCurrentImageIndex((prev) => (prev + 1) % currentImages.length);
    setSelectedImage(currentImages[(currentImageIndex + 1) % currentImages.length]);
  };

  const handleDownload = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `daynight-gallery-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleLike = (image: string) => {
    setLikedImages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(image)) {
        newSet.delete(image);
      } else {
        newSet.add(image);
      }
      return newSet;
    });
  };

  const handleShare = async (image: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: companyMeta.name,
          text: companyMeta.sloganEn,
          url: image,
        });
      } catch (error) {
        console.log("Share cancelled");
      }
    } else {
      await navigator.clipboard.writeText(image);
      alert(language === "ar" ? "تم نسخ رابط الصورة" : "Image link copied to clipboard");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImage) return;
      if (e.key === "ArrowLeft") isArabic ? handleNext() : handlePrev();
      if (e.key === "ArrowRight") isArabic ? handlePrev() : handleNext();
      if (e.key === "Escape") handleCloseLightbox();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImage, currentImageIndex, currentImages.length, isArabic]);

  const totalImages = galleryData.categories.reduce((acc, cat) => acc + cat.images.length, 0);

  return (
    <div
      className={`min-h-screen py-12 px-4 transition-colors duration-300 ${
        isLight
          ? "bg-gradient-to-b from-[#E8F0FE] via-[#DDE7F5] to-[#E8F0FE]"
          : "bg-gradient-to-b from-[#071A33] via-[#0A1C3A] to-[#071A33]"
      }`}
      data-gallery-debug="v2"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h1 className={`text-5xl md:text-7xl font-bold mb-4 ${isLight ? "text-brand-deep" : "text-white"}`}>
            <span className="bg-gradient-to-r from-[#D4AF37] via-[#F5B700] to-[#D4AF37] bg-clip-text text-transparent">
              {tg.title}
            </span>
          </h1>
          <p className={`text-xl max-w-2xl mx-auto ${isLight ? "text-brand-deep/60" : "text-white/60"}`}>
            {tg.subtitle}
          </p>
          <div className="w-24 h-1 bg-gradient-to-r from-[#D4AF37] to-[#F5B700] mx-auto mt-4 rounded-full" />
          <p className={`text-sm mt-2 ${isLight ? "text-brand-deep/40" : "text-white/40"}`}>
            {totalImages} {language === "ar" ? "صورة" : "images"} • {galleryData.categories.length}{" "}
            {language === "ar" ? "قسم" : "categories"}
          </p>
        </motion.div>

        {/* Category Navigation — inline color so it wins over CSS cascade */}
        <div
          className="flex flex-wrap justify-center gap-3 mb-12"
          style={{ color: isLight ? "#1a2b47" : "rgba(248,250,252,0.80)" }}
        >
          {galleryData.categories.map((category) => {
            const Icon = category.icon;
            const active = selectedCategory.id === category.id;
            const label = categoryLabels[category.id] || category.id;
            return (
              <button
                key={category.id}
                className={`dn-cat-btn${active ? " dn-cat-active" : ""}`}
                onClick={() => setSelectedCategory(category)}
              >
                <Icon size={15} />
                {label}
                <span style={{ fontSize: "11px", opacity: 0.55 }}>({category.images.length})</span>
              </button>
            );
          })}
        </div>

        {/* Gallery Grid */}
        <div ref={galleryRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {currentImages.map((image, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              whileHover={{ scale: 1.03, y: -5 }}
              className={`group relative rounded-2xl overflow-hidden cursor-pointer backdrop-blur-xl border ${
                isLight
                  ? "bg-white/60 border-brand-deep/10 hover:border-brand-gold/50"
                  : "bg-white/5 border-white/10 hover:border-brand-gold/30"
              }`}
              style={{ aspectRatio: "9/16" }}
            >
              <img
                src={image}
                alt={`Gallery ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
                onClick={() => handleImageClick(image, index)}
              />

              {/* Overlay */}
              <div
                className={`absolute inset-0 bg-gradient-to-t from-[#071A33]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
              >
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex justify-between items-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(image);
                      }}
                      className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
                    >
                      <Heart
                        className={`w-5 h-5 ${likedImages.has(image) ? "fill-red-500 text-red-500" : "text-white"}`}
                      />
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(image);
                        }}
                        className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
                      >
                        <Download className="w-5 h-5 text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(image);
                        }}
                        className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
                      >
                        <Share2 className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Lightbox */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-[#071A33]/95 backdrop-blur-xl flex items-center justify-center p-4"
              onClick={handleCloseLightbox}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-4xl w-full max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleCloseLightbox}
                  className="absolute -top-12 right-0 text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-8 h-8" />
                </button>

                <div className="relative rounded-2xl overflow-hidden bg-black/50">
                  <img
                    src={selectedImage}
                    alt="Gallery"
                    className="w-full h-full max-h-[80vh] object-contain"
                    onClick={() => setIsZoomed(!isZoomed)}
                  />

                  <button
                    onClick={handlePrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors text-white"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors text-white"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
                    <button
                      onClick={() => handleDownload(selectedImage)}
                      className="p-3 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors text-white"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleShare(selectedImage)}
                      className="p-3 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors text-white"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setIsZoomed(!isZoomed)}
                      className="p-3 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors text-white"
                    >
                      <ZoomIn className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm">
                    {currentImageIndex + 1} / {currentImages.length}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { value: totalImages, label: tg.imageCount },
            { value: galleryData.categories.length, label: tg.categoryCount },
            { value: likedImages.size, label: tg.likes },
            { value: "24/7", label: tg.service },
          ].map((stat, idx) => (
            <div
              key={idx}
              className={`text-center p-6 rounded-2xl backdrop-blur-xl border ${
                isLight
                  ? "bg-white/60 border-brand-deep/10"
                  : "bg-white/5 border-white/10"
              }`}
            >
              <p className="text-3xl font-bold text-[#D4AF37]">{stat.value}</p>
              <p className={`text-sm ${isLight ? "text-brand-deep/60" : "text-white/60"}`}>{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Brand Footer */}
        <div
          className={`mt-12 text-center text-sm border-t pt-8 ${
            isLight ? "border-brand-deep/10 text-brand-deep/40" : "border-white/5 text-white/40"
          }`}
        >
          <p className="text-[#D4AF37] font-bold">{companyMeta.name}</p>
          <p className={isLight ? "text-brand-deep/30" : "text-white/30"}>
            {language === "ar" ? companyMeta.sloganAr : companyMeta.sloganEn}
          </p>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 mt-3">
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" /> {companyMeta.phone}
            </span>
            <span className="flex items-center gap-1">
              <Mail className="w-3 h-3" /> {companyMeta.email}
            </span>
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3" /> {companyMeta.domain.replace("https://", "")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
