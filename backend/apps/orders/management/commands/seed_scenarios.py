"""Seed demo data: full catalog + 10 realistic Ordem de Serviço scenarios.

Fictional data for development / testing / homologation only. Re-runnable: the
catalog (categorias, peças, serviços, pacotes) is upserted; the demo customers,
their vehicles and their OS are recreated on every run.

    docker compose exec backend python manage.py seed_scenarios
"""

from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.categories.models import Category
from apps.customers.models import Customer
from apps.orders.models import (
    WorkOrder,
    WorkOrderPackage,
    WorkOrderPart,
    WorkOrderService,
)
from apps.parts.models import Part
from apps.services.models import (
    PackageService,
    Service,
    ServicePackage,
    ServicePart,
)
from apps.vehicles.models import Vehicle

OPENED = date(2026, 7, 4)
EXPECTED = date(2026, 7, 11)


def money(value):
    return Decimal(str(value))


def first_or_create(model, lookup, defaults=None):
    """Like get_or_create, but tolerant of pre-existing duplicate rows in a dev
    DB (e.g. two categories with the same name) -- returns the first match."""
    obj = model.objects.filter(**lookup).first()
    if obj is None:
        obj = model.objects.create(**{**lookup, **(defaults or {})})
    return obj


PART_CATEGORIES = [
    "Filtros",
    "Lubrificantes",
    "Freios",
    "Suspensão",
    "Arrefecimento",
    "Ignição",
    "Correias",
    "Elétrica",
    "Motor",
    "Câmbio",
    "Pneus",
    "Acessórios",
    "Diagnóstico",
    "Insumos",
]

SERVICE_CATEGORIES = [
    "Revisão preventiva",
    "Troca de óleo",
    "Freios",
    "Suspensão",
    "Diagnóstico eletrônico",
    "Arrefecimento",
    "Ignição",
    "Correias",
    "Motor",
    "Elétrica",
    "Câmbio",
    "Alinhamento e balanceamento",
    "Higienização",
    "Serviço avulso",
]

# internal_code, name, brand, part-category, unit, cost, sale, current, min
PARTS = [
    (
        "P-OL-5W30-001",
        "Óleo motor 5W30 sintético 1L",
        "Lubrax",
        "Lubrificantes",
        "liter",
        32,
        48,
        40,
        10,
    ),
    (
        "P-FILT-OLEO-023",
        "Filtro de óleo Honda/Fit/City",
        "Tecfil",
        "Filtros",
        "unit",
        24,
        45,
        12,
        5,
    ),
    (
        "P-FILT-AR-011",
        "Filtro de ar motor HB20 1.0",
        "Wega",
        "Filtros",
        "unit",
        28,
        55,
        8,
        4,
    ),
    (
        "P-FILT-CAB-009",
        "Filtro de cabine universal compacto",
        "Tecfil",
        "Filtros",
        "unit",
        22,
        50,
        15,
        6,
    ),
    (
        "P-FREIO-PD-ONIX-001",
        "Jogo de pastilhas dianteiras Onix/Prisma",
        "Fras-le",
        "Freios",
        "set",
        95,
        165,
        5,
        2,
    ),
    (
        "P-FREIO-DD-ONIX-001",
        "Disco de freio dianteiro Onix/Prisma",
        "Fremax",
        "Freios",
        "pair",
        210,
        360,
        3,
        1,
    ),
    (
        "P-IGN-VELA-NGK-004",
        "Jogo de velas NGK Iridium",
        "NGK",
        "Ignição",
        "set",
        180,
        290,
        4,
        2,
    ),
    (
        "P-COR-KIT-GOL16-001",
        "Kit correia dentada Gol 1.6",
        "Gates",
        "Correias",
        "kit",
        230,
        390,
        2,
        1,
    ),
    (
        "P-ARREF-ADT-001",
        "Aditivo para radiador concentrado 1L",
        "Paraflu",
        "Arrefecimento",
        "liter",
        25,
        45,
        10,
        4,
    ),
    (
        "P-SUSP-BIEL-COR-001",
        "Bieleta dianteira Corolla",
        "Nakata",
        "Suspensão",
        "pair",
        95,
        170,
        3,
        1,
    ),
]

# name, service-category, labor_cost, estimated_minutes, [(part_code, qty)]
SERVICES = [
    (
        "Troca de óleo do motor",
        "Troca de óleo",
        "Remoção do óleo usado, substituição do filtro de óleo e aplicação de óleo novo conforme especificação do veículo.",
        90,
        40,
        [("P-OL-5W30-001", 4), ("P-FILT-OLEO-023", 1)],
    ),
    (
        "Substituição de pastilhas de freio dianteiras",
        "Freios",
        "Substituição do jogo de pastilhas dianteiras, limpeza dos componentes e teste de frenagem.",
        180,
        90,
        [("P-FREIO-PD-ONIX-001", 1)],
    ),
    (
        "Diagnóstico eletrônico com scanner",
        "Diagnóstico eletrônico",
        "Leitura de módulos eletrônicos, códigos de falha, parâmetros em tempo real e apagamento de falhas após avaliação.",
        150,
        60,
        [],
    ),
    (
        "Substituição de velas de ignição",
        "Ignição",
        "Substituição das velas de ignição e conferência básica do sistema de ignição.",
        160,
        60,
        [("P-IGN-VELA-NGK-004", 1)],
    ),
    (
        "Substituição da correia dentada",
        "Correias",
        "Substituição da correia dentada, tensor e componentes relacionados conforme aplicação do veículo.",
        550,
        240,
        [("P-COR-KIT-GOL16-001", 1), ("P-ARREF-ADT-001", 2)],
    ),
    (
        "Revisão do sistema de arrefecimento",
        "Arrefecimento",
        "Inspeção do sistema de arrefecimento, verificação de vazamentos, teste de pressão e substituição de fluido/aditivo quando necessário.",
        220,
        120,
        [("P-ARREF-ADT-001", 2)],
    ),
    (
        "Diagnóstico e reparo de suspensão dianteira",
        "Suspensão",
        "Diagnóstico da suspensão dianteira, substituição de bieletas/buchas e aperto geral, com alinhamento após o reparo.",
        300,
        120,
        [("P-SUSP-BIEL-COR-001", 1)],
    ),
]

# name, description, [service names]
PACKAGES = [
    (
        "Revisão Básica",
        "Manutenção preventiva simples (troca de óleo, filtro e inspeções rápidas), normalmente a cada 10.000 km.",
        ["Troca de óleo do motor"],
    ),
    (
        "Revisão Completa",
        "Revisão ampla com filtros, óleo, inspeções e diagnóstico eletrônico básico.",
        ["Troca de óleo do motor", "Diagnóstico eletrônico com scanner"],
    ),
    (
        "Freio Dianteiro Completo",
        "Indicado para desgaste de pastilhas/disco ou ruído na frenagem dianteira.",
        ["Substituição de pastilhas de freio dianteiras"],
    ),
    (
        "Suspensão Dianteira",
        "Indicado para ruídos, folgas ou instabilidade na dianteira do veículo.",
        ["Diagnóstico e reparo de suspensão dianteira"],
    ),
]

# name, whatsapp, plate, brand, model, model_year, mileage
CUSTOMERS_VEHICLES = [
    ("Mariana Souza", "11988881234", "ABC1D23", "Honda", "Fit 1.5", 2016, 82450),
    ("Rafael Mendes", "21977775544", "BRA2E19", "Chevrolet", "Onix 1.0", 2019, 64210),
    ("Carla Martins", "31966662233", "QWE3R45", "Hyundai", "HB20 1.0", 2018, 91700),
    ("João Pereira", "41955557788", "FRT8H22", "Volkswagen", "Gol 1.6", 2015, 118300),
    (
        "Fernanda Almeida",
        "19944448899",
        "HJK4L90",
        "Toyota",
        "Corolla 2.0",
        2017,
        102900,
    ),
    ("Eduardo Lima", "51933331122", "MNO7P10", "Fiat", "Palio 1.4", 2013, 146500),
    ("Patrícia Gomes", "27922226677", "JKL5M67", "Hyundai", "HB20 1.0", 2020, 58000),
    (
        "Lucas Nascimento",
        "85911114455",
        "RTY6U44",
        "Renault",
        "Sandero 1.6",
        2016,
        109800,
    ),
    ("Beatriz Rocha", "62900007788", "KLM9N88", "Ford", "Ka 1.0", 2014, 132000),
    ("André Carvalho", "13988001010", "NVS1A18", "Nissan", "Versa 1.6", 2018, 76300),
]


class Command(BaseCommand):
    help = (
        "Seed demo catalog + 10 realistic Ordem de Serviço scenarios (dev/test only)."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        cats = self._seed_categories()
        parts = self._seed_parts(cats)
        services = self._seed_services(cats, parts)
        packages = self._seed_packages(services)
        customers, vehicles = self._seed_customers_vehicles()
        numbers = self._seed_work_orders(customers, vehicles, services, packages, parts)

        self.stdout.write(
            self.style.SUCCESS(
                "Seed concluído: "
                f"{len(PART_CATEGORIES) + len(SERVICE_CATEGORIES)} categorias, "
                f"{len(parts)} peças, {len(services)} serviços, {len(packages)} pacotes, "
                f"{len(customers)} clientes/veículos e {len(numbers)} OS "
                f"(números {numbers[0]}–{numbers[-1]})."
            )
        )

    def _seed_categories(self):
        cats = {"part": {}, "service": {}}
        for name in PART_CATEGORIES:
            cats["part"][name] = first_or_create(
                Category, {"category_type": "part", "name": name}
            )
        for name in SERVICE_CATEGORIES:
            cats["service"][name] = first_or_create(
                Category, {"category_type": "service", "name": name}
            )
        return cats

    def _seed_parts(self, cats):
        parts = {}
        for code, name, brand, cat, unit, cost, sale, cur, minimum in PARTS:
            obj = first_or_create(
                Part,
                {"internal_code": code},
                {
                    "name": name,
                    "brand": brand,
                    "category": cats["part"][cat],
                    "unit_of_measure": unit,
                    "cost_price": money(cost),
                    "sale_price": money(sale),
                    "current_quantity": money(cur),
                    "min_quantity": money(minimum),
                    "is_active": True,
                },
            )
            parts[code] = obj
        return parts

    def _seed_services(self, cats, parts):
        services = {}
        for name, cat, desc, labor, minutes, std in SERVICES:
            obj = first_or_create(
                Service,
                {"name": name},
                {
                    "category": cats["service"][cat],
                    "description": desc,
                    "labor_cost": money(labor),
                    "estimated_minutes": minutes,
                    "is_active": True,
                },
            )
            # Rebuild the standard parts to keep quantities correct on re-run.
            obj.standard_parts.all().delete()
            ServicePart.objects.bulk_create(
                ServicePart(
                    service=obj, part=parts[code], suggested_quantity=money(qty)
                )
                for code, qty in std
            )
            services[name] = obj
        return services

    def _seed_packages(self, services):
        packages = {}
        for name, desc, service_names in PACKAGES:
            obj = first_or_create(
                ServicePackage,
                {"name": name},
                {
                    "description": desc,
                    "discount_type": "none",
                    "is_active": True,
                },
            )
            obj.items.all().delete()
            PackageService.objects.bulk_create(
                PackageService(package=obj, service=services[n]) for n in service_names
            )
            packages[name] = obj
        return packages

    def _seed_customers_vehicles(self):
        customers, vehicles = {}, {}
        for name, whatsapp, plate, brand, model, year, mileage in CUSTOMERS_VEHICLES:
            customer = first_or_create(Customer, {"name": name}, {"whatsapp": whatsapp})
            if customer.whatsapp != whatsapp:
                customer.whatsapp = whatsapp
                customer.save(update_fields=["whatsapp"])
            # Look up by plate AND demo customer so pre-existing duplicate plates
            # in a polluted dev DB never get picked up or overwritten.
            vehicle = first_or_create(
                Vehicle, {"license_plate": plate, "customer": customer}
            )
            # Keep the demo vehicle's details in sync even if it pre-existed.
            vehicle.brand = brand
            vehicle.model = model
            vehicle.model_year = year
            vehicle.mileage = mileage
            vehicle.is_active = True
            vehicle.save()
            customers[name] = customer
            vehicles[name] = vehicle
        return customers, vehicles

    def _scenarios(self, s, p, k):
        """Each OS: (customer, status, mileage, report, diagnosis, notes,
        discount_type, discount_value, services, packages, parts).

        Line tuples are (obj|None, description, quantity, unit_price). A None obj
        means an avulso (free-text) line kept only inside this OS.
        """
        return [
            (
                "Mariana Souza",
                "open",
                82450,
                "Veículo próximo da revisão; deseja troca de óleo. Percebeu leve aumento no consumo, sem falhas aparentes.",
                "Óleo do motor vencido por tempo e quilometragem. Filtro de óleo saturado. Filtro de ar ainda aceitável. Sem vazamentos aparentes.",
                "Oferecer revisão completa na próxima visita (filtro de ar e de cabine). Cliente quer retirar no mesmo dia.",
                "none",
                0,
                [(s["Troca de óleo do motor"], "Troca de óleo do motor", 1, 90)],
                [],
                [
                    (p["P-OL-5W30-001"], "Óleo motor 5W30 sintético 1L", 4, 48),
                    (p["P-FILT-OLEO-023"], "Filtro de óleo Honda/Fit/City", 1, 45),
                ],
            ),
            (
                "Rafael Mendes",
                "awaiting_approval",
                64210,
                "Ruído metálico ao frear, principalmente em baixa velocidade. Pedal normal, mas o barulho aumentou.",
                "Pastilhas dianteiras no limite. Discos com sulcos e espessura abaixo do recomendado. Fluido escurecido, sem vazamento. Recomendado pacote de freio dianteiro completo.",
                "Não iniciar sem aprovação. Explicar que trocar só as pastilhas não é recomendado pelo desgaste dos discos.",
                "fixed",
                45,
                [],
                [(k["Freio Dianteiro Completo"], "Freio Dianteiro Completo", 1, 380)],
                [
                    (
                        p["P-FREIO-PD-ONIX-001"],
                        "Jogo de pastilhas dianteiras Onix/Prisma",
                        1,
                        165,
                    ),
                    (
                        p["P-FREIO-DD-ONIX-001"],
                        "Disco de freio dianteiro Onix/Prisma",
                        1,
                        360,
                    ),
                ],
            ),
            (
                "Carla Martins",
                "diagnosing",
                91700,
                "Luz da injeção acesa e falha em marcha lenta. Piora com o ar-condicionado ligado.",
                "Scanner indicou falha de combustão no cilindro 2. Velas com desgaste avançado. Bobina irregular em teste cruzado. Bobina específica não cadastrada no estoque (peça avulsa).",
                "Confirmar disponibilidade da bobina com o fornecedor antes da aprovação. Cliente depende do carro para trabalho.",
                "none",
                0,
                [
                    (
                        s["Diagnóstico eletrônico com scanner"],
                        "Diagnóstico eletrônico com scanner",
                        1,
                        150,
                    ),
                    (
                        s["Substituição de velas de ignição"],
                        "Substituição de velas de ignição",
                        1,
                        160,
                    ),
                    (None, "Teste cruzado de bobina e chicote de ignição", 1, 80),
                ],
                [],
                [
                    (p["P-IGN-VELA-NGK-004"], "Jogo de velas NGK Iridium", 1, 290),
                    (None, "Bobina de ignição cilindro 2 HB20 1.0", 1, 320),
                ],
            ),
            (
                "João Pereira",
                "approved",
                118300,
                "Comprou o veículo usado recentemente, sem histórico de troca da correia dentada. Solicita revisão preventiva.",
                "Sem comprovação de troca recente. Correia com ressecamento e pequenas trincas. Recomendado kit completo. Bomba d'água sem vazamento aparente, será avaliada.",
                "Serviço crítico. Registrar troca preventiva por ausência de comprovação. Conferir sincronismo antes da partida. Fotografar a correia antiga.",
                "fixed",
                30,
                [
                    (
                        s["Substituição da correia dentada"],
                        "Substituição da correia dentada",
                        1,
                        550,
                    )
                ],
                [],
                [
                    (p["P-COR-KIT-GOL16-001"], "Kit correia dentada Gol 1.6", 1, 390),
                    (
                        p["P-ARREF-ADT-001"],
                        "Aditivo para radiador concentrado 1L",
                        2,
                        45,
                    ),
                ],
            ),
            (
                "Fernanda Almeida",
                "in_progress",
                102900,
                "Barulho seco na dianteira em lombadas e ruas irregulares. Veículo parece instável em curvas.",
                "Folga nas bieletas dianteiras e início de desgaste nas buchas da bandeja. Amortecedores sem vazamento. Recomendado trocar bieletas e alinhar.",
                "Cliente autorizou apenas troca de bieletas e alinhamento. Orçar buchas da bandeja à parte se o ruído persistir.",
                "none",
                0,
                [],
                [(k["Suspensão Dianteira"], "Suspensão Dianteira", 1, 450)],
                [(p["P-SUSP-BIEL-COR-001"], "Bieleta dianteira Corolla", 1, 170)],
            ),
            (
                "Eduardo Lima",
                "awaiting_parts",
                146500,
                "Carro aqueceu no trânsito e a luz de temperatura acendeu. Completou água no reservatório duas vezes na última semana.",
                "Vazamento na mangueira superior do radiador. Tampa do reservatório desgastada. Ventoinha normal. Recomendado trocar mangueira, tampa e limpar com aditivo.",
                "Mangueira específica não cadastrada (peça avulsa). Recomendar revisão completa do arrefecimento no retorno.",
                "none",
                0,
                [
                    (
                        s["Revisão do sistema de arrefecimento"],
                        "Revisão do sistema de arrefecimento",
                        1,
                        220,
                    ),
                    (
                        None,
                        "Substituição emergencial da mangueira superior do radiador",
                        1,
                        120,
                    ),
                ],
                [],
                [
                    (
                        p["P-ARREF-ADT-001"],
                        "Aditivo para radiador concentrado 1L",
                        2,
                        45,
                    ),
                    (None, "Mangueira superior do radiador Palio 1.4", 1, 110),
                    (None, "Tampa do reservatório de expansão Palio", 1, 45),
                ],
            ),
            (
                "Patrícia Gomes",
                "ready",
                58000,
                "Solicitou revisão completa antes de viagem. Sem falhas; quer verificar óleo, filtros, freios, pneus e scanner.",
                "Bom estado geral. Óleo e filtros próximos do vencimento. Freios em boa condição. Scanner sem falhas ativas. Pneus calibrados e sem desgaste irregular.",
                "Cliente viaja no fim de semana; priorizar entrega no mesmo dia. Registrar que o scanner não acusou falhas.",
                "fixed",
                62,
                [],
                [(k["Revisão Completa"], "Revisão Completa", 1, 520)],
                [
                    (p["P-OL-5W30-001"], "Óleo motor 5W30 sintético 1L", 4, 48),
                    (p["P-FILT-OLEO-023"], "Filtro de óleo Honda/Fit/City", 1, 45),
                    (p["P-FILT-AR-011"], "Filtro de ar motor HB20 1.0", 1, 55),
                    (p["P-FILT-CAB-009"], "Filtro de cabine universal compacto", 1, 50),
                ],
            ),
            (
                "Lucas Nascimento",
                "open",
                109800,
                "Comprou o veículo recentemente e quer uma revisão geral simples, sem a revisão completa. Pediu apenas uma checagem rápida dos itens principais.",
                "Óleo dentro do prazo, filtros a verificar. Freios regulares. Suspensão com ruído leve, sem troca imediata. Recomendado pacote avulso de inspeção pós-compra.",
                "Cliente não quer criar pacote fixo no sistema. Usar pacote avulso apenas nesta OS. Se repetir, avaliar cadastrar 'Inspeção pós-compra'.",
                "none",
                0,
                [],
                [(None, "Inspeção pós-compra básica", 1, 250)],
                [],
            ),
            (
                "Beatriz Rocha",
                "open",
                132000,
                "Barulho intermitente na parte traseira, sem conseguir identificar quando acontece. Solicita apenas avaliação inicial.",
                "Diagnóstico não finalizado. Necessário rodar com o veículo para reproduzir o ruído. Nenhuma peça aplicada no momento.",
                "Registrar avaliação inicial com serviço avulso sem valor. Após diagnóstico completo, atualizar a OS com serviço definitivo e orçamento.",
                "none",
                0,
                [(None, "Avaliação inicial de ruído traseiro", 1, 0)],
                [],
                [],
            ),
            (
                "André Carvalho",
                "awaiting_approval",
                76300,
                "Solicitou troca de velas por manutenção preventiva, mas quer aprovar apenas o necessário.",
                "Velas com desgaste moderado. Ignição sem falhas no scanner. Bobinas normais. Serviço recomendado, sem urgência crítica.",
                "O serviço sugere jogo de velas como peça padrão. Cliente avalia trazer a própria peça; se trouxer, registrar aqui e não vender a peça da oficina (peça padrão removida da OS).",
                "none",
                0,
                [
                    (
                        s["Substituição de velas de ignição"],
                        "Substituição de velas de ignição",
                        1,
                        160,
                    )
                ],
                [],
                [],
            ),
        ]

    def _seed_work_orders(self, customers, vehicles, services, packages, parts):
        # Recreate the demo OS on every run (keeps numbers stable on a fresh DB).
        WorkOrder.objects.filter(customer__in=customers.values()).delete()

        numbers = []
        for (
            name,
            status,
            mileage,
            report,
            diagnosis,
            notes,
            discount_type,
            discount_value,
            svc_lines,
            pkg_lines,
            part_lines,
        ) in self._scenarios(services, parts, packages):
            order = WorkOrder.objects.create(
                customer=customers[name],
                vehicle=vehicles[name],
                status=status,
                opened_at=OPENED,
                expected_delivery=EXPECTED,
                current_mileage=mileage,
                customer_report=report,
                diagnosis=diagnosis,
                internal_notes=notes,
                discount_type=discount_type,
                discount_value=money(discount_value),
            )
            WorkOrderService.objects.bulk_create(
                WorkOrderService(
                    order=order,
                    service=obj,
                    description=desc,
                    quantity=money(qty),
                    unit_price=money(price),
                )
                for obj, desc, qty, price in svc_lines
            )
            WorkOrderPackage.objects.bulk_create(
                WorkOrderPackage(
                    order=order,
                    package=obj,
                    description=desc,
                    quantity=money(qty),
                    unit_price=money(price),
                )
                for obj, desc, qty, price in pkg_lines
            )
            WorkOrderPart.objects.bulk_create(
                WorkOrderPart(
                    order=order,
                    part=obj,
                    description=desc,
                    quantity=money(qty),
                    unit_price=money(price),
                )
                for obj, desc, qty, price in part_lines
            )
            numbers.append(order.number)
        return numbers
