"use client";
import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { resolvePredictionImageUrl } from "@/lib/predictionImage";

interface Props {
  imageUrl?: string;
  backendId?: number;
  className?: string;
}

export default function ScanThumbnail({ imageUrl, backendId, className = "w-16 h-16" }: Props) {
  const [src, setSrc] = useState("");
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBroken(false);
    setSrc("");

    resolvePredictionImageUrl(backendId, imageUrl).then((url) => {
      if (!cancelled) setSrc(url);
    });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, backendId]);

  if (!src || broken) {
    return (
      <div
        className={`${className} rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0`}
      >
        <ImageOff className="w-5 h-5 text-gray-600" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={`${className} rounded-lg object-cover bg-gray-800 border border-gray-700/80 flex-shrink-0`}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}
