import {
  BatteryCharging,
  Boxes,
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Cog,
  Cpu,
  Disc3,
  Droplets,
  Gauge,
  Handshake,
  History,
  type LucideIcon,
  ListChecks,
  RefreshCw,
  Ruler,
  ShieldCheck,
  Snowflake,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

export interface NavLink {
  label: string;
  href: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: "Início", href: "#inicio" },
  { label: "Serviços", href: "#servicos" },
  { label: "Marcas atendidas", href: "#marcas" },
  { label: "Por que a gente", href: "#diferenciais" },
  { label: "Depoimentos", href: "#depoimentos" },
  { label: "Sobre", href: "#sobre" },
  { label: "Contato", href: "#contato" },
];

export const BRANDS: string[] = [
  "Volkswagen",
  "Chevrolet",
  "Fiat",
  "Ford",
  "Toyota",
  "Honda",
  "Hyundai",
  "Renault",
  "Peugeot",
  "Citroën",
  "Nissan",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Volvo",
  "Jeep",
  "Mitsubishi",
  "Kia",
];

export const HERO_BADGES: string[] = [
  "Diagnóstico técnico",
  "Orçamento transparente",
  "Atendimento com agendamento",
  "Mecânica preventiva e corretiva",
  "Acompanhamento da OS",
];

export interface IconItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const WHY_CHOOSE: IconItem[] = [
  {
    icon: Handshake,
    title: "Atendimento transparente",
    description:
      "Comunicação clara em todas as etapas: você sempre sabe o que está sendo feito no seu veículo.",
  },
  {
    icon: ClipboardCheck,
    title: "Orçamento antes da execução",
    description:
      "Você recebe as informações de serviços e peças, com valores e prazos, e aprova antes de começar.",
  },
  {
    icon: Gauge,
    title: "Diagnóstico técnico",
    description:
      "Avaliação criteriosa para identificar a causa real do problema, sem trocas desnecessárias.",
  },
  {
    icon: Users,
    title: "Equipe qualificada",
    description: "Profissionais experientes em mecânica preventiva e corretiva.",
  },
  {
    icon: History,
    title: "Histórico do veículo",
    description:
      "Cada serviço fica registrado, facilitando manutenções futuras e a revenda do veículo.",
  },
  {
    icon: CalendarClock,
    title: "Agendamento prático",
    description: "Marque seu atendimento e evite espera desnecessária na oficina.",
  },
  {
    icon: ListChecks,
    title: "Acompanhamento da OS",
    description:
      "Você é avisado a cada avanço da Ordem de Serviço, do diagnóstico à retirada.",
  },
  {
    icon: ShieldCheck,
    title: "Garantia dos serviços",
    description: "Trabalho feito com responsabilidade e garantia conforme a política da oficina.",
  },
];

export const SERVICES_FALLBACK: IconItem[] = [
  { icon: Gauge, title: "Diagnóstico automotivo", description: "Identificação técnica de falhas com equipamentos e experiência." },
  { icon: CalendarCheck, title: "Revisão preventiva", description: "Manutenção programada para evitar problemas e prolongar a vida do veículo." },
  { icon: Droplets, title: "Troca de óleo e filtros", description: "Óleo e filtros adequados para o motor do seu carro." },
  { icon: Disc3, title: "Sistema de freios", description: "Pastilhas, discos e revisão completa da frenagem." },
  { icon: Cog, title: "Suspensão", description: "Amortecedores, molas e componentes para conforto e segurança." },
  { icon: Wrench, title: "Motor", description: "Manutenção e reparos do motor com diagnóstico preciso." },
  { icon: Cpu, title: "Injeção eletrônica", description: "Leitura e ajuste do sistema de injeção e gestão do motor." },
  { icon: Zap, title: "Sistema elétrico", description: "Diagnóstico e reparo da parte elétrica do veículo." },
  { icon: Snowflake, title: "Ar-condicionado", description: "Higienização, carga de gás e reparos do climatizador." },
  { icon: BatteryCharging, title: "Bateria", description: "Teste, substituição e verificação do sistema de carga." },
  { icon: RefreshCw, title: "Correias", description: "Troca de correias e tensionadores no prazo correto." },
  { icon: Ruler, title: "Alinhamento e balanceamento", description: "Direção alinhada e rodas balanceadas para dirigir com segurança." },
  { icon: ClipboardList, title: "Preparação para revisão", description: "Deixe o carro em dia para inspeções e revisões periódicas." },
  { icon: Boxes, title: "Manutenção geral", description: "Cuidados completos para manter o veículo sempre pronto." },
];

export interface HowStep {
  title: string;
  description: string;
}

export const HOW_STEPS: HowStep[] = [
  { title: "Agende ou entre em contato", description: "Você marca o atendimento ou fala com a nossa equipe." },
  { title: "Recebimento do veículo", description: "Recebemos o veículo na oficina e registramos a entrada." },
  { title: "Check-in inicial", description: "Registro das condições e do relato do cliente." },
  { title: "Diagnóstico", description: "O mecânico avalia o veículo e identifica o que precisa ser feito." },
  { title: "Orçamento", description: "Você recebe o orçamento com serviços, peças, valores e prazos." },
  { title: "Aprovação", description: "Você aprova total ou parcialmente o que deseja executar." },
  { title: "Execução", description: "Realizamos apenas os serviços aprovados por você." },
  { title: "Conferência e teste", description: "O veículo passa por verificação de qualidade." },
  { title: "Aviso de retirada", description: "Avisamos assim que o veículo estiver pronto." },
  { title: "OS finalizada", description: "A Ordem de Serviço é concluída e fica registrada no histórico." },
];

export interface Testimonial {
  name: string;
  rating: number;
  service: string;
  quote: string;
}

// Depoimentos de exemplo (estrutura pronta para dados reais do painel).
export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Ricardo M.",
    rating: 5,
    service: "Revisão preventiva",
    quote:
      "Atendimento muito claro e organizado. Recebi o orçamento antes da execução e fui informado sobre cada etapa do serviço.",
  },
  {
    name: "Fernanda L.",
    rating: 5,
    service: "Diagnóstico e freios",
    quote:
      "Explicaram direitinho o que o carro precisava e o que dava para deixar para depois. Sem empurrar serviço.",
  },
  {
    name: "Carlos A.",
    rating: 5,
    service: "Sistema elétrico",
    quote:
      "Resolveram um problema elétrico que ninguém achava. Equipe atenciosa e preço justo.",
  },
  {
    name: "Juliana P.",
    rating: 5,
    service: "Troca de óleo e revisão",
    quote:
      "Consegui agendar sem enrolação e retirei no horário combinado. Recomendo!",
  },
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ: FaqItem[] = [
  {
    question: "Preciso agendar antes de levar o carro?",
    answer:
      "O agendamento é recomendado para reduzir a espera e garantir a melhor disponibilidade da equipe, mas você também pode entrar em contato para verificar o atendimento no dia.",
  },
  {
    question: "Vocês fazem orçamento antes de executar o serviço?",
    answer:
      "Sim. Você recebe o orçamento com os serviços e peças, valores e prazos, e só executamos após a sua aprovação.",
  },
  {
    question: "Posso aprovar apenas parte do orçamento?",
    answer:
      "Pode. Você aprova total ou parcialmente os itens do orçamento e executamos apenas o que foi autorizado.",
  },
  {
    question: "Como acompanho o andamento da OS?",
    answer:
      "Você é avisado a cada avanço importante da Ordem de Serviço, do diagnóstico até a liberação para retirada.",
  },
  {
    question: "A oficina oferece garantia?",
    answer:
      "Os serviços têm garantia conforme a política da oficina, informada no momento da entrega.",
  },
  {
    question: "Posso levar minhas próprias peças?",
    answer:
      "Consulte a nossa equipe. Em alguns casos é possível, com condições específicas de garantia sobre a peça fornecida por você.",
  },
  {
    question: "Quais formas de pagamento são aceitas?",
    answer: "Consulte as formas de pagamento disponíveis com o nosso atendimento.",
  },
  {
    question: "Quanto tempo demora o diagnóstico?",
    answer:
      "Depende do tipo de problema. Após a avaliação inicial informamos o prazo estimado antes de seguir com o orçamento.",
  },
];
