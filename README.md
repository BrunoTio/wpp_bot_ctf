# Bot simple de WhatsApp para CTF

Bot minimo para WhatsApp Cloud API. Cada mensaje entrante recibe siempre la misma imagen y el mismo texto.

No usa Chatwoot, panel de operador ni base de datos.

## 1. Preparar variables

Copia el ejemplo:

```bash
cp .env.example .env
```

En Windows:

```powershell
copy .env.example .env
```

Completa `.env`:

```env
PORT=3000
VERIFY_TOKEN=un_token_largo_inventado_por_vos
WHATSAPP_TOKEN=token_de_meta
PHONE_NUMBER_ID=id_del_numero_en_meta
GRAPH_API_VERSION=v23.0
RESPONSE_TEXT=Felicitaciones. Esta es la pista del juego.
RESPONSE_IMAGE_URL=https://url-publica/imagen.jpg
```

Notas:

- `VERIFY_TOKEN` lo inventas vos. Debe coincidir con el token que pongas en Meta al configurar el webhook.
- `PHONE_NUMBER_ID` no es el numero de telefono visible. Es el ID numerico que muestra Meta.
- `WHATSAPP_TOKEN` puede ser temporal para probar, pero en servidor conviene usar un token permanente de System User.
- La imagen debe ser publica si usas `RESPONSE_IMAGE_URL`.
- Si subis la imagen a WhatsApp Cloud API, podes usar `RESPONSE_IMAGE_ID` en lugar de `RESPONSE_IMAGE_URL`.

## 2. Probar local

```bash
npm start
```

El bot queda escuchando en:

```txt
http://localhost:3000
```

Healthcheck:

```txt
http://localhost:3000/health
```

## 3. Probar con ngrok

Con el bot corriendo localmente:

```bash
ngrok http 3000
```

Ngrok te dara una URL HTTPS, por ejemplo:

```txt
https://abc123.ngrok-free.app
```

En Meta, configura:

```txt
URL de devolucion de llamada: https://abc123.ngrok-free.app/webhook
Token de verificacion: el mismo valor de VERIFY_TOKEN
```

Despues suscribite al campo:

```txt
messages
```

## 4. Subir a GitHub

Inicializa el repo:

```bash
git init
git add .
git commit -m "Initial WhatsApp CTF bot"
```

Crea un repo vacio en GitHub y conecta el remoto:

```bash
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

Importante: `.env` esta ignorado y no debe subirse.

## 5. Correr en servidor con Docker

En el servidor:

```bash
git clone https://github.com/TU_USUARIO/TU_REPO.git
cd TU_REPO
cp .env.example .env
nano .env
docker compose up -d --build
```

Ver logs:

```bash
docker compose logs -f
```

Reiniciar luego de cambios:

```bash
git pull
docker compose up -d --build
```

## 6. Publicar HTTPS en el servidor

Meta exige HTTPS publico. La forma mas simple en un VPS es poner un reverse proxy delante del puerto `3000`.

Opcion rapida para pruebas:

```bash
ngrok http 3000
```

Opcion recomendada para dejarlo fijo:

- Apuntar un dominio o subdominio al servidor.
- Usar Caddy, Nginx Proxy Manager, Traefik o Nginx con certificado TLS.
- Configurar el proxy para enviar trafico a `http://localhost:3000`.

La URL final en Meta debe quedar asi:

```txt
https://tu-dominio.com/webhook
```

## 7. Checklist de Meta

En WhatsApp Cloud API:

- Callback URL: `https://tu-dominio.com/webhook`
- Verify token: mismo valor que `VERIFY_TOKEN`
- Webhook field: `messages`
- Phone Number ID: copiarlo a `PHONE_NUMBER_ID`
- Access token: copiarlo a `WHATSAPP_TOKEN`

## Endpoints

- `GET /health`: verifica que el bot esta vivo.
- `GET /webhook`: verificacion inicial de Meta.
- `POST /webhook`: eventos de mensajes entrantes.
