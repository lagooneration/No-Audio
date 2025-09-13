// import BentoGrid from "@/components/BentoGrid";
import DarkVeil from "@/components/DarkVeil";
import MagicBento from "@/components/MagicBento";
import Image from "next/image";

export default function Home() {
  return (
    <main>
      <div style={{  width: '100%', height: '100%', zIndex: '-1', position: 'absolute' }}>
          <DarkVeil />
        </div>
      <div className="container pt-4">
        <div className="my-4">
          <Image src="/logo.svg" alt="Knowaudio Logo" width={170} height={50} />
        </div>
        {/* <BentoGrid /> */}
        <div className="flex justify-center mb-4">
        <MagicBento
          textAutoHide={true}
              enableStars={true}
              enableSpotlight={true}
              enableBorderGlow={true}
              enableTilt={true}
              enableMagnetism={true}
              clickEffect={true}
              spotlightRadius={300}
              particleCount={12}
              glowColor="132, 0, 255"
        />
        </div>
      </div>
    </main>
  );
}