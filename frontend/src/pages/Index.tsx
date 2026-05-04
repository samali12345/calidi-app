import HeroSection from "@/components/HeroSection";
import CategorySection from "@/components/CategorySection";
import FeaturedProducts from "@/components/FeaturedProducts";
import WesternWearSection from "@/components/WesternWearSection";
import HomeRecommendations from "@/components/HomeRecommendations";
import BrowsingRecommendations from "@/components/BrowsingRecommendations";

export default function Index() {
  return (
    <main>
      <HeroSection />
      <CategorySection />
      <FeaturedProducts />
      <WesternWearSection />
      <BrowsingRecommendations />
      <HomeRecommendations />
    </main>
  );
}
