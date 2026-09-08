# TENO - Sistema ERP de Gestión de Ventas

Sistema interno de gestión de ventas, clientes, inventario y reportes para TENO.

**Objetivo**: Herramienta 100% interna para que vendedores registren ventas y operadores gestionen el negocio.

---

## 📋 Descripción

TENO es una plataforma web diseñada para:
- 👤 **Vendedores**: Registrar ventas, ver clientes, consultar reportes propios
- 👥 **Operadores**: Gestionar vendedores, ver todas las ventas, generar reportes, personalizar interfaz
- 🔑 **Administrador**: Control total del sistema, configuración, backups

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
|-----------|-----------|
| **Frontend** | React 18+ |
| **Backend** | Node.js + Express |
| **Base de datos** | PostgreSQL 14+ |
| **Autenticación** | JWT (tokens) |
| **Hosting Backend** | Render.com |
| **Hosting Frontend** | Vercel.com |
| **Repositorio** | GitHub |

---

## 💻 Requisitos Locales

Antes de empezar, asegúrate de tener instalado:

- **Node.js** v18+ ([descargar](https://nodejs.org/))
- **PostgreSQL** 14+ ([descargar](https://www.postgresql.org/))
- **Git** ([descargar](https://git-scm.com/))
- **VS Code** o editor de código ([descargar](https://code.visualstudio.com/))

**Verifica que estén instalados:**
```bash
node --version
npm --version
psql --version
git --version
```

---

## 🚀 Instalación Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/tuusuario/TENO.git
cd TENO
```

### 2. Backend - Express + Node.js

```bash
cd backend
npm install
```

Copia `.env.example` a `.env`:
```bash
copy .env.example .env
```

Edita `.env` con tus datos reales.

Inicia el servidor:
```bash
npm run dev
```

### 3. Frontend - React (Vite)

En otra terminal:
```bash
cd frontend
npm install
npm run dev
```

Abre http://localhost:5173

---

## 📁 Estructura del Proyecto

TENO/
├── backend/ # Servidor Node.js + Express
├── frontend/ # Aplicación React
├── database/ # Scripts SQL
├── docs/ # Documentación
├── .env.example # Plantilla de variables
├── .gitignore # Archivos a ignorar
└── README.md # Este archivo

---

## 🔐 Sistema de Roles

| Rol | Descripción |
|-----|-----------|
| **Vendedor** | Registra ventas, ve sus datos |
| **Operador** | Gestiona vendedores, reportes |
| **Admin** | Control total |

---

## 🔑 Credenciales de Desarrollo

Admin: admin@teno.com / 123456
Vendedor: vendedor@teno.com / 123456
---

## 📚 Variables de Entorno

Archivo: `.env` (crear desde `.env.example`)

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=teno_erp_dev
DB_USER=postgres
DB_PASSWORD=tu_contraseña
JWT_SECRET=clave_secreta_aqui
```

Frontend (`frontend/.env`, ver `.env.example`):
```env
VITE_API_URL=http://localhost:3000
```

---

## 🚀 Deploy

- **Backend**: Render.com
- **Frontend**: Vercel.com
- **Base de datos**: PostgreSQL en Railway o Render

---

**Versión**: 1.0.0-beta

**Última actualización**: Septiembre 2026

