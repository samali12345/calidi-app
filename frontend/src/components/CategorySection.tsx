import categoryEthnic from "@/assets/category-women.png"; // Use your existing women assets
import categoryWestern from "@/assets/product-6.png";     // Use a dress/outerwear asset
import categoryNew from "@/assets/product-1.png";
import { Link } from "react-router-dom";

// UPDATED: Women-only sub-categories
const categories = [
  { name: "Ethnic", label: "Ethnic Collection", image: categoryEthnic },
  { name: "Western", label: "Western Wear", image: categoryWestern },
  { name: "New", label: "New Arrivals", image: categoryNew },
];

export default function CategorySection() {
  return (
    <section className="py-20 px-6">
      <div className="container mx-auto text-center">
        <h2 className="font-display text-3xl md:text-4xl mb-12 uppercase tracking-widest">
          Shop the Collection
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              to={`/shop?category=${cat.name}`}
              className="group relative aspect-square overflow-hidden bg-secondary"
            >
              <img
                src={cat.image}
                alt={cat.label}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
              <div className="absolute inset-0 flex items-end p-8">
                <h3 className="font-display text-2xl text-white uppercase tracking-widest">
                  {cat.label}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}