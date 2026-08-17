-- Habilitar extensión para generar UUIDs si no está activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TABLA: CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    telefono TEXT, -- Formato internacional para WhatsApp (ej. +5491123456789)
    email TEXT,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABLA: CONSULTAS
CREATE TABLE IF NOT EXISTS consultas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    fecha_consulta DATE DEFAULT CURRENT_DATE NOT NULL,
    fecha_interes DATE NOT NULL,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'respondida', 'reserva_creada', 'desestimada')),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABLA: RESERVAS
CREATE TABLE IF NOT EXISTS reservas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    monto_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    monto_senia NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    estado_pago TEXT DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'senia_pagada', 'total_pagado')),
    estado_reserva TEXT DEFAULT 'pre-reserva' CHECK (estado_reserva IN ('pre-reserva', 'confirmada', 'cancelada')),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT chk_fechas CHECK (fecha_fin >= fecha_inicio)
);

-- TABLA: VISITAS
CREATE TABLE IF NOT EXISTS visitas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    nombre_visitante TEXT, -- Por si no es un cliente registrado (ej. "Electricista")
    fecha_hora_visita TIMESTAMP WITH TIME ZONE NOT NULL,
    motivo TEXT,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABLA: TRANSACCIONES (Caja / Contabilidad)
CREATE TABLE IF NOT EXISTS transacciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
    monto NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    categoria TEXT NOT NULL CHECK (categoria IN ('reserva_senia', 'reserva_saldo', 'limpieza', 'mantenimiento', 'servicios', 'impuestos', 'otros')),
    fecha DATE DEFAULT CURRENT_DATE NOT NULL,
    reserva_id UUID REFERENCES reservas(id) ON DELETE SET NULL,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABLA: PLANTILLAS DE WHATSAPP
CREATE TABLE IF NOT EXISTS plantillas_whatsapp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL UNIQUE, -- Ej: 'Confirmación disponibilidad', 'Solicitud de Seña'
    mensaje TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- INSERTAR PLANTILLAS POR DEFECTO
INSERT INTO plantillas_whatsapp (titulo, mensaje) VALUES
('Disponibilidad Positiva', '¡Hola {nombre}! Te confirmo que el día {fecha} la quinta está libre. El valor de la estadía es de {monto}. Si te interesa, decime y te reservo provisionalmente el día por 24 horas.'),
('Solicitud de Seña', '¡Hola {nombre}! Para confirmar la reserva de la quinta el día {fecha}, te pido una seña de {monto}. Podés transferir al alias: quinta.mama.mp y enviarme el comprobante. ¡Muchas gracias!'),
('Confirmación de Reserva', '¡Hola {nombre}! Recibí la seña correctamente. Tu reserva para el día {fecha} ya está confirmada. ¡Te esperamos!'),
('Recordatorio de Saldo', '¡Hola {nombre}! Te recuerdo que el saldo pendiente de tu reserva para el día {fecha} es de {monto}. Podés abonarlo por transferencia antes de ingresar. ¡Saludos!')
ON CONFLICT (titulo) DO NOTHING;
