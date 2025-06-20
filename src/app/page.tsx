// src/app/page.tsx
'use client'; 

import type { ReactNode } from 'react';
import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Search as SearchIcon, AlertTriangle, Brain, ListChecks, Bot, ArrowRight, Link as LinkIcon, CreditCard, Loader2 } from "lucide-react";
import Link from "next/link";
import type { PropertyListing, SearchRequest, LandingSectionKey, Plan } from "@/lib/types";
import { fetchGoogleSheetDataAction, getGoogleSheetConfigAction } from "@/actions/googleSheetActions";
import { getPropertiesAction } from "@/actions/propertyActions";
import { getRequestsAction } from "@/actions/requestActions";
import { getSiteSettingsAction } from "@/actions/siteSettingsActions";
import { getEditableTextsByGroupAction } from '@/actions/editableTextActions';
import { getPlansAction } from '@/actions/planActions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import PaginatedSheetTable from "@/components/google-sheet/PaginatedSheetTable";
import FeaturedListingsClient from '@/components/landing/FeaturedListingsClient';
import InteractiveAIMatching from '@/components/landing/InteractiveAIMatching';
import PlanDisplayCard from '@/components/plan/PlanDisplayCard';


async function getFeaturedListingsAndRequestsData() {
  const [allProperties, allRequests] = await Promise.all([
    getPropertiesAction({ limit: 8, orderBy: 'popularity_desc' }),
    getRequestsAction({ includeInactive: false, limit: 8, orderBy: 'createdAt_desc' }) // Added limit and order
  ]);
  const featuredProperties = allProperties;
  // Sorting for recentRequests is now handled by orderBy in getRequestsAction if 'createdAt_desc' is default
  const recentRequests = allRequests;
  return { featuredProperties, recentRequests };
}

async function getFeaturedPlansData(limit: number = 3) {
  const plans = await getPlansAction({ showAllAdmin: false }); // This already fetches only active and visible
  return plans.sort((a,b) => a.price_monthly - b.price_monthly).slice(0, limit); // Ensure consistent order for "featured"
}

// --- Section Components ---

function AIMatchingSection() {
  return (
    <Card className="shadow-xl rounded-2xl overflow-hidden border bg-card">
      <CardHeader className="p-6 md:p-8">
        <CardTitle className="text-3xl md:text-4xl font-headline flex items-center text-foreground">
          <Brain className="h-8 w-8 mr-3 text-primary" />
          IA: Describe tu Búsqueda Ideal
        </CardTitle>
        <CardDescription className="text-lg text-muted-foreground mt-2">
          Escribe lo que buscas (tipo de propiedad, características, ubicación, etc.) y nuestra IA buscará propiedades y solicitudes compatibles en la plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 md:p-8 pt-0 md:pt-0">
        <InteractiveAIMatching />
        <div className="mt-8 text-sm text-muted-foreground space-y-3 pt-6 border-t border-border/70">
          <p className="flex items-start sm:items-center gap-2 flex-col sm:flex-row">
            <LinkIcon className="h-4 w-4 text-primary flex-shrink-0" />
            <strong>¿Buscas propiedades para una solicitud ya publicada?</strong>
            <Button variant="link" asChild className="p-0 h-auto text-sm text-left">
              <Link href="/ai-matching-properties">Usa la herramienta de búsqueda de propiedades para solicitudes (IA)</Link>
            </Button>
          </p>
          <p className="flex items-start sm:items-center gap-2 flex-col sm:flex-row">
            <LinkIcon className="h-4 w-4 text-primary flex-shrink-0" />
            <strong>¿Tienes una propiedad y buscas solicitudes compatibles?</strong>
            <Button variant="link" asChild className="p-0 h-auto text-sm text-left">
              <Link href="/ai-matching">Prueba la búsqueda de solicitudes para propiedades (IA)</Link>
            </Button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalisisWhatsBotSectionClient({ initialConfig, initialSheetData }: { initialConfig: Awaited<ReturnType<typeof getGoogleSheetConfigAction>>, initialSheetData: Awaited<ReturnType<typeof fetchGoogleSheetDataAction>> }) {
  if (!initialConfig || !initialConfig.isConfigured) {
    return (
      <Card className="bg-muted/30 shadow-lg rounded-2xl border border-dashed">
        <CardHeader className="p-6 md:p-8">
          <CardTitle className="text-2xl md:text-3xl flex items-center text-muted-foreground">
            <AlertTriangle className="h-7 w-7 mr-3 text-yellow-500" />
            Análisis WhatsBot
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <p className="text-base text-muted-foreground">
            Esta sección mostrará datos para el Análisis WhatsBot, pero aún no ha sido configurada.
            Un administrador puede habilitarla desde el <Link href="/admin/settings" className="text-primary hover:underline font-medium">panel de configuración</Link>.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!initialSheetData) {
    return (
      <Card className="shadow-xl rounded-2xl border bg-card">
        <CardHeader className="p-6 md:p-8">
          <CardTitle className="text-3xl md:text-4xl font-headline flex items-center text-foreground">
            <Bot className="h-8 w-8 mr-3 text-primary" />
            Análisis WhatsBot
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">No se pudieron cargar los datos. Verifica la configuración y la consola del servidor para más detalles.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <p className="text-base text-muted-foreground">Asegúrate de que el ID de la hoja, el nombre de la pestaña y las columnas sean correctos, y que la hoja esté compartida públicamente.</p>
        </CardContent>
      </Card>
    );
  }

  if (initialSheetData.rows.length === 0 && initialSheetData.headers.length > 0) {
    return (
      <Card className="shadow-xl rounded-2xl border bg-card">
        <CardHeader className="p-6 md:p-8">
          <CardTitle className="text-3xl md:text-4xl font-headline flex items-center text-foreground">
            <Bot className="h-8 w-8 mr-3 text-primary" />
            Análisis WhatsBot
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">La fuente de datos está configurada pero no contiene filas de datos (solo encabezados).</CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <PaginatedSheetTable headers={initialSheetData.headers} rows={initialSheetData.rows} />
        </CardContent>
      </Card>
    );
  }

  if (initialSheetData.headers.length === 0) {
    return (
      <Card className="shadow-xl rounded-2xl border bg-card">
        <CardHeader className="p-6 md:p-8">
          <CardTitle className="text-3xl md:text-4xl font-headline flex items-center text-foreground">
            <Bot className="h-8 w-8 mr-3 text-primary" />
            Análisis WhatsBot
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">No se encontraron encabezados en la fuente de datos. Verifica la configuración.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl rounded-2xl border bg-card">
      <CardHeader className="p-6 md:p-8">
        <CardTitle className="text-3xl md:text-4xl font-headline flex items-center text-foreground">
          <Bot className="h-8 w-8 mr-3 text-primary" />
          Análisis WhatsBot
        </CardTitle>
        <CardDescription className="text-lg text-muted-foreground mt-2">Información relevante para el análisis de interacciones del bot.</CardDescription>
      </CardHeader>
      <CardContent className="p-6 md:p-8">
        <PaginatedSheetTable headers={initialSheetData.headers} rows={initialSheetData.rows} />
      </CardContent>
    </Card>
  );
}

interface FeaturedPlansSectionProps {
  plans: Plan[];
}
function FeaturedPlansSection({ plans }: FeaturedPlansSectionProps) {
  if (!plans || plans.length === 0) {
    return (
      <Card className="bg-muted/30 shadow-lg rounded-2xl border border-dashed">
        <CardHeader className="p-6 md:p-8">
          <CardTitle className="text-2xl md:text-3xl flex items-center text-muted-foreground">
            <CreditCard className="h-7 w-7 mr-3 text-yellow-500" />
            Planes Destacados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <p className="text-base text-muted-foreground">
            Actualmente no hay planes destacados para mostrar. Visita nuestra página de planes para más información.
          </p>
          <Button asChild variant="link" className="mt-3 px-0">
            <Link href="/plans">Ver todos los planes</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl rounded-2xl overflow-hidden border bg-card">
      <CardHeader className="p-6 md:p-8 bg-secondary/30">
        <CardTitle className="text-3xl md:text-4xl font-headline flex items-center text-foreground">
          <CreditCard className="h-8 w-8 mr-3 text-primary" />
          Planes Destacados
        </CardTitle>
        <CardDescription className="text-lg text-muted-foreground mt-2">
          Descubre nuestros planes y elige el que mejor se adapte a tus necesidades.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 md:p-8">
        {/* Grid for plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-center">
          {plans.map((plan) => (
            <div key={plan.id} className="flex justify-center"> {/* Center each card in its grid cell */}
              <PlanDisplayCard plan={plan} />
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Button asChild size="lg" variant="outline" className="rounded-lg">
            <Link href="/plans">Ver todos los planes <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const DEFAULT_SECTIONS_ORDER: LandingSectionKey[] = ["featured_list_requests", "featured_plans", "ai_matching", "analisis_whatsbot"];
const DEFAULT_HERO_TITLE = "Encuentra Tu Espacio Ideal en konecte";
const DEFAULT_HERO_SUBTITLE = "Descubre, publica y comenta sobre propiedades en arriendo o venta. ¡O publica lo que estás buscando!";
const DEFAULT_SEARCH_PLACEHOLDER = "Buscar por ubicación, tipo, características...";
const DEFAULT_PUBLISH_PROPERTY_BUTTON = "Publicar Propiedad";
const DEFAULT_PUBLISH_REQUEST_BUTTON = "Publicar Solicitud";

// --- HomePage Component ---
export default function HomePage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const [siteSettings, setSiteSettings] = useState<Awaited<ReturnType<typeof getSiteSettingsAction>> | null>(null);
  const [homeTexts, setHomeTexts] = useState<Awaited<ReturnType<typeof getEditableTextsByGroupAction>> | null>(null);
  const [listingsData, setListingsData] = useState<Awaited<ReturnType<typeof getFeaturedListingsAndRequestsData>> | null>(null);
  const [featuredPlansData, setFeaturedPlansData] = useState<Awaited<ReturnType<typeof getFeaturedPlansData>> | null>(null);
  const [googleSheetConfig, setGoogleSheetConfig] = useState<Awaited<ReturnType<typeof getGoogleSheetConfigAction>> | null>(null);
  const [googleSheetData, setGoogleSheetData] = useState<Awaited<ReturnType<typeof fetchGoogleSheetDataAction>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      setErrorLoading(null);
      try {
        // Paralelizar las llamadas independientes
        const [
          settings,
          texts,
          listings,
          plans,
          gSheetConfigResult
        ] = await Promise.all([
          getSiteSettingsAction(),
          getEditableTextsByGroupAction('home'),
          getFeaturedListingsAndRequestsData(),
          getFeaturedPlansData(3),
          getGoogleSheetConfigAction()
        ]);

        setSiteSettings(settings);
        setHomeTexts(texts);
        setListingsData(listings);
        setFeaturedPlansData(plans);
        setGoogleSheetConfig(gSheetConfigResult);

        // Carga condicional de datos de Google Sheet
        if (gSheetConfigResult && gSheetConfigResult.isConfigured) {
          const gSheetDataResult = await fetchGoogleSheetDataAction();
          setGoogleSheetData(gSheetDataResult);
        }

      } catch (error: any) {
        console.error("Error loading initial data for HomePage:", error);
        setErrorLoading(error.message || "Ocurrió un error al cargar los datos de la página.");
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();
  }, []);


  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/properties?searchTerm=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
            <p className="text-xl text-muted-foreground">Cargando konecte...</p>
        </div>
    );
  }
  
  if (errorLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
            <AlertTriangle className="h-16 w-16 text-destructive mb-6" />
            <h1 className="text-2xl font-bold mb-3">Error al Cargar la Página</h1>
            <p className="text-lg text-muted-foreground mb-4">{errorLoading}</p>
            <p className="text-sm text-muted-foreground mb-8">Por favor, intenta recargar la página o contacta a soporte si el problema persiste.</p>
            <Button onClick={() => window.location.reload()}>Recargar Página</Button>
        </div>
    );
  }
  
  if (!siteSettings || !homeTexts || !listingsData || !featuredPlansData) {
     return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
            <AlertTriangle className="h-16 w-16 text-destructive mb-6" />
            <h1 className="text-2xl font-bold mb-3">Error Inesperado</h1>
            <p className="text-lg text-muted-foreground mb-8">No se pudieron cargar todos los datos necesarios para mostrar la página. Por favor, intenta recargar.</p>
            <Button onClick={() => window.location.reload()}>Recargar Página</Button>
        </div>
    );
  }


  const heroTitle = homeTexts.home_hero_title || DEFAULT_HERO_TITLE;
  const heroSubtitle = homeTexts.home_hero_subtitle || DEFAULT_HERO_SUBTITLE;
  const searchPlaceholder = homeTexts.home_search_placeholder || DEFAULT_SEARCH_PLACEHOLDER;
  const publishPropertyButtonText = homeTexts.home_publish_property_button || DEFAULT_PUBLISH_PROPERTY_BUTTON;
  const publishRequestButtonText = homeTexts.home_publish_request_button || DEFAULT_PUBLISH_REQUEST_BUTTON;

  const showFeaturedListings = siteSettings?.show_featured_listings_section === undefined ? true : siteSettings.show_featured_listings_section;
  const showFeaturedPlans = siteSettings?.show_featured_plans_section === undefined ? true : siteSettings.show_featured_plans_section;
  const showAiMatching = siteSettings?.show_ai_matching_section === undefined ? true : siteSettings.show_ai_matching_section;
  const showAnalisisWhatsBot = siteSettings?.show_google_sheet_section === undefined ? true : siteSettings.show_google_sheet_section;
  const sectionsOrder = siteSettings?.landing_sections_order || DEFAULT_SECTIONS_ORDER;

  const sectionComponentsRender: Record<LandingSectionKey, () => ReactNode | null> = {
    featured_list_requests: () => showFeaturedListings && listingsData ? (
      <Card className="shadow-xl rounded-2xl overflow-hidden border bg-card">
        <CardHeader className="p-6 md:p-8 bg-secondary/30">
          <CardTitle className="text-3xl md:text-4xl font-headline flex items-center text-foreground">
            <ListChecks className="h-8 w-8 mr-3 text-primary" />
            Destacados y Recientes
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">Explora las últimas propiedades y las solicitudes de búsqueda más nuevas.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <FeaturedListingsClient
            featuredProperties={listingsData.featuredProperties}
            recentRequests={listingsData.recentRequests}
          />
        </CardContent>
      </Card>
    ) : null,
    featured_plans: () => showFeaturedPlans && featuredPlansData ? <FeaturedPlansSection plans={featuredPlansData} /> : null,
    ai_matching: () => showAiMatching ? <AIMatchingSection /> : null,
    analisis_whatsbot: () => showAnalisisWhatsBot ? <AnalisisWhatsBotSectionClient initialConfig={googleSheetConfig} initialSheetData={googleSheetData} /> : null,
  };
  
  return (
    <div className="space-y-16 md:space-y-24 lg:space-y-28">
      <section className="text-center py-16 md:py-24 lg:py-32 bg-card rounded-3xl shadow-2xl overflow-hidden relative border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-60"></div>
        <div className="container mx-auto px-4 relative z-10">
          <h1 className="text-4xl font-headline font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl !leading-tight text-foreground">
            {heroTitle}
          </h1>
          <p className="mt-6 max-w-xl mx-auto text-lg text-muted-foreground sm:text-xl md:mt-8 md:text-2xl md:max-w-3xl">
            {heroSubtitle}
          </p>
          <div className="mt-10 max-w-2xl mx-auto">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Input
                type="search"
                placeholder={searchPlaceholder}
                className="flex-grow text-base h-14 rounded-xl shadow-lg focus:ring-2 focus:ring-primary px-6 border-border focus:border-primary transition-all"
                aria-label="Buscar propiedades y solicitudes"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button size="lg" className="h-14 rounded-xl flex items-center gap-2 text-base shadow-lg hover:shadow-xl transition-all px-8 bg-primary hover:bg-primary/90 text-primary-foreground" type="submit">
                <SearchIcon className="h-5 w-5" /> Buscar
              </Button>
            </form>
          </div>
          <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6">
            <Button size="lg" variant="default" asChild className="w-full sm:w-auto rounded-xl text-base sm:text-lg h-16 px-8 sm:px-10 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="/properties/submit">
                <PlusCircle className="mr-2.5 h-5 w-5 sm:h-6 sm:w-6" /> {publishPropertyButtonText}
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild className="w-full sm:w-auto rounded-xl text-base sm:text-lg h-16 px-8 sm:px-10 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 bg-card hover:bg-muted border border-border">
              <Link href="/requests/submit">
                <PlusCircle className="mr-2.5 h-5 w-5 sm:h-6 sm:w-6" /> {publishRequestButtonText}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {sectionsOrder.map(key => {
        const SectionRenderer = sectionComponentsRender[key];
        return SectionRenderer ? <div key={key}>{SectionRenderer()}</div> : null;
      })}
    </div>
  );
}
