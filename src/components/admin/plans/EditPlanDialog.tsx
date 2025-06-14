
// src/components/admin/plans/EditPlanDialog.tsx
'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { Plan } from '@/lib/types';
import { updatePlanAction } from '@/actions/planActions';
import { Loader2, Save, MessageSquare } from 'lucide-react'; // Added MessageSquare

interface EditPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan | null;
  onPlanUpdated: () => void;
}

type PlanFormValues = {
  name: string;
  description: string | null;
  price_monthly: string;
  price_currency: string;
  max_properties_allowed: string | null;
  max_requests_allowed: string | null;
  max_ai_searches_monthly: string | null;
  whatsapp_bot_enabled: boolean; // Nuevo campo
  can_feature_properties: boolean;
  property_listing_duration_days: string | null;
  is_active: boolean;
  is_publicly_visible: boolean;
};

export default function EditPlanDialog({ open, onOpenChange, plan, onPlanUpdated }: EditPlanDialogProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<PlanFormValues>({
    defaultValues: {
      name: '',
      description: '',
      price_monthly: '0',
      price_currency: 'CLP',
      max_properties_allowed: '',
      max_requests_allowed: '',
      max_ai_searches_monthly: '',
      whatsapp_bot_enabled: false, // Por defecto
      can_feature_properties: false,
      property_listing_duration_days: '',
      is_active: true,
      is_publicly_visible: true,
    },
  });

  useEffect(() => {
    if (plan && open) {
      form.reset({
        name: plan.name,
        description: plan.description || '',
        price_monthly: Number.isFinite(plan.price_monthly) ? plan.price_monthly.toString() : '0',
        price_currency: plan.price_currency || 'CLP',
        max_properties_allowed: plan.max_properties_allowed?.toString() || '',
        max_requests_allowed: plan.max_requests_allowed?.toString() || '',
        max_ai_searches_monthly: plan.max_ai_searches_monthly?.toString() || '',
        whatsapp_bot_enabled: plan.whatsapp_bot_enabled || false, // Nuevo campo
        can_feature_properties: plan.can_feature_properties,
        property_listing_duration_days: plan.property_listing_duration_days?.toString() || '',
        is_active: plan.is_active,
        is_publicly_visible: plan.is_publicly_visible === undefined ? true : plan.is_publicly_visible,
      });
    } else if (!open) {
      form.reset(); 
    }
  }, [plan, open, form]);

  const handleSubmit = async (values: PlanFormValues) => {
    if (!plan?.id) {
      toast({ title: "Error", description: "ID del plan no encontrado.", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append('name', values.name);
    if (values.description) formData.append('description', values.description);
    formData.append('price_monthly', values.price_monthly);
    formData.append('price_currency', values.price_currency);
    if (values.max_properties_allowed) formData.append('max_properties_allowed', values.max_properties_allowed);
    if (values.max_requests_allowed) formData.append('max_requests_allowed', values.max_requests_allowed);
    if (values.max_ai_searches_monthly) formData.append('max_ai_searches_monthly', values.max_ai_searches_monthly);
    if (values.whatsapp_bot_enabled) formData.append('whatsapp_bot_enabled', 'on'); // Nuevo campo
    if (values.can_feature_properties) formData.append('can_feature_properties', 'on');
    if (values.property_listing_duration_days) formData.append('property_listing_duration_days', values.property_listing_duration_days);
    if (values.is_active) formData.append('is_active', 'on');
    if (values.is_publicly_visible) formData.append('is_publicly_visible', 'on');
    
    startTransition(async () => {
      const result = await updatePlanAction(plan.id, formData);
      if (result.success) {
        toast({ title: "Plan Actualizado", description: result.message });
        onPlanUpdated();
        onOpenChange(false);
      } else {
        toast({ title: "Error al Actualizar Plan", description: result.message, variant: "destructive" });
      }
    });
  };

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Plan: {plan.name}</DialogTitle>
          <DialogDescription>Modifica los detalles del plan de suscripción.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Plan *</FormLabel>
                  <FormControl><Input placeholder="Ej: Básico, Premium" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price_monthly"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Precio Mensual ({form.watch('price_currency')}) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" placeholder="Ej: 5000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl><Textarea placeholder="Breve descripción del plan" rows={2} {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="max_properties_allowed"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Máx. Propiedades</FormLabel>
                        <FormControl><Input type="number" min="0" placeholder="Vacío ilimitado" {...field} value={field.value ?? ''}/></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="max_requests_allowed"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Máx. Solicitudes</FormLabel>
                        <FormControl><Input type="number" min="0" placeholder="Vacío ilimitado" {...field} value={field.value ?? ''}/></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                  control={form.control}
                  name="max_ai_searches_monthly"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>Máx. Búsquedas IA</FormLabel>
                          <FormControl><Input type="number" min="0" placeholder="Vacío ilimitado" {...field} value={field.value ?? ''}/></FormControl>
                          <FormMessage />
                      </FormItem>
                  )}
                />
                <FormField
                control={form.control}
                name="property_listing_duration_days"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Duración Public. (días)</FormLabel>
                        <FormControl><Input type="number" min="0" placeholder="Vacío indefinido" {...field} value={field.value ?? ''}/></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <div className="flex flex-col space-y-3 pt-2">
                <FormField
                    control={form.control}
                    name="can_feature_properties"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <Label htmlFor={field.name} className="font-normal">Permite Destacar Propiedades</Label>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="whatsapp_bot_enabled"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <Label htmlFor={field.name} className="font-normal flex items-center gap-1"><MessageSquare className="h-4 w-4 text-green-600"/>Habilitar Chat WhatsApp Bot</Label>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <Label htmlFor={field.name} className="font-normal">Plan Activo (puede ser asignado)</Label>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="is_publicly_visible"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <Label htmlFor={field.name} className="font-normal">Visible Públicamente (en página de planes)</Label>
                        </FormItem>
                    )}
                />
            </div>
             <Input type="hidden" {...form.register('price_currency')} />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !form.formState.isDirty}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
