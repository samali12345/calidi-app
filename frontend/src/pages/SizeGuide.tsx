import { Ruler } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const womenSizes = [
  { size: "XS", us: "0–2", bust: '31–32"', waist: '24–25"', hips: '34–35"' },
  { size: "S", us: "4–6", bust: '33–34"', waist: '26–27"', hips: '36–37"' },
  { size: "M", us: "8–10", bust: '35–36"', waist: '28–29"', hips: '38–39"' },
  { size: "L", us: "12–14", bust: '37–39"', waist: '30–32"', hips: '40–42"' },
  { size: "XL", us: "16", bust: '40–42"', waist: '33–35"', hips: '43–45"' },
];

const menSizes = [
  { size: "S", chest: '34–36"', waist: '28–30"', hips: '35–37"' },
  { size: "M", chest: '38–40"', waist: '32–34"', hips: '38–40"' },
  { size: "L", chest: '42–44"', waist: '36–38"', hips: '41–43"' },
  { size: "XL", chest: '46–48"', waist: '40–42"', hips: '44–46"' },
  { size: "XXL", chest: '50–52"', waist: '44–46"', hips: '47–49"' },
];

export default function SizeGuide() {
  return (
    <main className="min-h-screen bg-background">
      <section className="container mx-auto px-6 py-16 max-w-3xl">
        <div className="flex items-center gap-3 mb-2">
          <Ruler size={22} className="text-primary" />
          <h1 className="font-display text-4xl font-bold tracking-wider text-foreground">
            Size Guide
          </h1>
        </div>
        <p className="font-body text-muted-foreground mb-10">
          Find your perfect fit. All measurements are in inches and refer to body measurements, not garment dimensions.
        </p>

        <Tabs defaultValue="women" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="women" className="font-body tracking-wider uppercase text-xs">Women</TabsTrigger>
            <TabsTrigger value="men" className="font-body tracking-wider uppercase text-xs">Men</TabsTrigger>
          </TabsList>

          <TabsContent value="women">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body uppercase tracking-wider text-xs">Size</TableHead>
                  <TableHead className="font-body uppercase tracking-wider text-xs">US</TableHead>
                  <TableHead className="font-body uppercase tracking-wider text-xs">Bust</TableHead>
                  <TableHead className="font-body uppercase tracking-wider text-xs">Waist</TableHead>
                  <TableHead className="font-body uppercase tracking-wider text-xs">Hips</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {womenSizes.map((row) => (
                  <TableRow key={row.size}>
                    <TableCell className="font-body font-semibold text-foreground">{row.size}</TableCell>
                    <TableCell className="font-body text-muted-foreground">{row.us}</TableCell>
                    <TableCell className="font-body text-muted-foreground">{row.bust}</TableCell>
                    <TableCell className="font-body text-muted-foreground">{row.waist}</TableCell>
                    <TableCell className="font-body text-muted-foreground">{row.hips}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="men">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body uppercase tracking-wider text-xs">Size</TableHead>
                  <TableHead className="font-body uppercase tracking-wider text-xs">Chest</TableHead>
                  <TableHead className="font-body uppercase tracking-wider text-xs">Waist</TableHead>
                  <TableHead className="font-body uppercase tracking-wider text-xs">Hips</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {menSizes.map((row) => (
                  <TableRow key={row.size}>
                    <TableCell className="font-body font-semibold text-foreground">{row.size}</TableCell>
                    <TableCell className="font-body text-muted-foreground">{row.chest}</TableCell>
                    <TableCell className="font-body text-muted-foreground">{row.waist}</TableCell>
                    <TableCell className="font-body text-muted-foreground">{row.hips}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>

        <div className="mt-12 rounded-lg border border-border p-6 font-body text-sm text-muted-foreground space-y-3">
          <h3 className="font-display text-lg font-semibold text-foreground">How to Measure</h3>
          <p><span className="text-foreground font-medium">Bust/Chest:</span> Measure around the fullest part of your chest, keeping the tape level.</p>
          <p><span className="text-foreground font-medium">Waist:</span> Measure around your natural waistline, the narrowest part of your torso.</p>
          <p><span className="text-foreground font-medium">Hips:</span> Measure around the widest part of your hips and buttocks.</p>
          <p className="text-xs pt-2">If you fall between sizes, we recommend sizing up for a more relaxed fit or sizing down for a closer fit.</p>
        </div>
      </section>
    </main>
  );
}
