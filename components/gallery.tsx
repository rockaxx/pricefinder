'use client'
import { useState } from 'react'
import Image from 'next/image'
export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0)
  return (
    <div className="gallery">
      <Image
        unoptimized
        width={560}
        height={420}
        loading="eager"
        src={images[active]}
        alt={name}
      />
      {images.length > 1 && (
        <div className="trending">
          {images.map((src, i) => (
            <button
              type="button"
              key={src}
              className="icon-button"
              aria-label={'Obrázok ' + (i + 1)}
              aria-pressed={active === i}
              onClick={() => setActive(i)}
            >
              <Image unoptimized width={42} height={36} src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
