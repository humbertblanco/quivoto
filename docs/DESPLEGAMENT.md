# Desplegament de quivoto.cat

## Estat: EN LÍNIA a https://quivoto.cat

Fet el **26 d'agost de 2026**.

| Cosa | Valor |
|---|---|
| Servidor | `server.estic.online` · AlmaLinux 9.8 · Plesk Obsidian 18.0.80.4 |
| IP | **37.187.151.83** (IPv6: `2001:41d0:a:5753::`) |
| Subscripció | `quivoto.cat`, propietari `admin`, pla «Unlimited» |
| Titular legal | Damos en el Blanco, S.L. · CIF B75676460 · Cta. Reial 95, 08960 Sant Just Desvern |
| Bústia | `hola@quivoto.cat` creada (contrasenya a `/root/quivoto-credencials.txt`) |
| Còpia de seguretat | `/usr/local/bin/quivoto-copia.sh`, cada dia a les 4:17 (cron de root), 30 dies |
| Usuari del sistema | `quivoto` — contrasenya a `/root/quivoto-credencials.txt` (només root) |
| Arrel web | `/var/www/vhosts/quivoto.cat/httpdocs` |
| Dades (fora del web) | `/var/www/vhosts/quivoto.cat/private/data/quivoto.sqlite` |
| PHP | 8.3 FPM (`plesk-php83-fpm`), amb `pdo_sqlite` i `gd` |
| `www` | ja resolt com a `ServerAlias` |
| Servidors de noms | `howard.ns.cloudflare.com`, `harleigh.ns.cloudflare.com` |

### Comprovat al servidor (amb capçalera `Host`, perquè el DNS encara no hi apunta)

- `http://` → **301** cap a `https://`
- Portada, `/es/`, privadesa, avís legal, CSS, tipografies, `og.png`, `robots.txt`, `sitemap.xml`: **200**
- Capçaleres de seguretat actives (CSP, HSTS, nosniff, referrer-policy, permissions-policy)
- Google Analytics actiu amb la propietat `G-9ZB1XZ3LHT`; la CSP permet només el carregador i els endpoints d'Analytics necessaris.
- Formulari: alta correcta, desada a SQLite **fora** de l'arrel web
- La base de dades **no** és accessible des del web
- Alta de prova esborrada
- Pàgines legals amb les dades reals del titular i del proveïdor (OVH SAS, França)

### DNS i certificat: FETS

Registres creats a Cloudflare (zona `f70fc55b…`) amb la global key que hi ha a
`clients.damosenelblanco.com/httpdocs/.env`:

```
A  quivoto.cat      37.187.151.83   proxy: off
A  www.quivoto.cat  37.187.151.83   proxy: off
```

Certificat Let's Encrypt emès i instal·lat (`CN=quivoto.cat`, vàlid fins al 24-11-2026,
renovació automàtica de Plesk). Comprovat en producció: `https://` 200, `www` i `http`
redirigeixen, `/es/` 200, formulari operatiu.

**Següent pas opcional**: posar el núvol taronja a Cloudflare i SSL/TLS en *Full (strict)*
per tenir CDN i protecció. Amb el certificat ja instal·lat, es pot fer sense trencar res.

### Referència: com es va fer el DNS

**1. Registre DNS a Cloudflare** — la zona existeix però està buida:

```
Tipus  Nom              Contingut         Proxy
A      quivoto.cat      37.187.151.83     DNS only (núvol gris)  ← de moment
A      www              37.187.151.83     DNS only (núvol gris)
```

Cal el núvol **gris** al principi perquè Let's Encrypt pugui validar el domini.

**2. Certificat, un cop el DNS propagui:**

```bash
ssh root@server.estic.online \
  "plesk bin extension --exec letsencrypt cli.php -d quivoto.cat -d www.quivoto.cat -m hola@quivoto.cat"
```

I després, a Cloudflare: posar el núvol **taronja** i SSL/TLS en **Full (strict)**.

---

## 3. Requisits del servidor

- PHP **8.1 o superior** amb `pdo_sqlite` (Plesk: *Configuració PHP → extensions*).
- Apache amb `mod_rewrite`, `mod_headers`, `mod_expires`, `mod_deflate`.
- Certificat Let's Encrypt (Plesk el gestiona sol).
- Res més: ni base de dades externa, ni Node, ni Composer.

## 4. DNS: dues opcions

### Opció A — directe al servidor (més simple)
A DonDominio, a la zona de `quivoto.cat`:

```
A     @      <IP del servidor>
A     www    <IP del servidor>
```

Esperar la propagació (TTL de DonDominio, sol ser 1 h). Prou per començar.

### Opció B — Cloudflare al davant (recomanada quan hi hagi trànsit)
1. Crear el lloc a Cloudflare i copiar els dos servidors de noms que doni.
2. A DonDominio, canviar els servidors de noms als de Cloudflare.
3. A Cloudflare, registres `A @` i `A www` cap a la IP del servidor, **amb el núvol taronja**.
4. SSL/TLS → **Full (strict)**, i mantenir el certificat Let's Encrypt al servidor.
5. Regla de cau: `/assets/*` amb cau llarga; l'HTML, curta.

> Si es fa servir Cloudflare, el `.htaccess` ja té en compte la capçalera
> `X-Forwarded-Proto` perquè la redirecció a HTTPS no entri en bucle,
> i `api/lib.php` ja llegeix `HTTP_CF_CONNECTING_IP` per al límit d'abús.

## 5. Crear el vhost a Plesk

### Amb el panell
1. **Llocs web i dominis → Afegeix un domini** → `quivoto.cat`, amb `www` inclòs.
2. **Arrel del document**: `httpdocs` (hi copiarem el contingut de `web/public/`).
3. **PHP**: versió 8.1+, gestor FPM.
4. **SSL/TLS → Let's Encrypt**: emetre per a `quivoto.cat` i `www.quivoto.cat`,
   i activar *Redirecció permanent de HTTP a HTTPS*.
5. **Hosting → Allotjament web**: desactivar l'accés FTP anònim i els llistats de directoris.

### Amb la línia d'ordres (si hi ha SSH d'administrador)
```bash
plesk bin subscription --create quivoto.cat -owner admin -service-plan "Unlimited" -ip <IP>
plesk bin site --update quivoto.cat -php_handler_id "plesk-php82-fpm" -ssl true
plesk bin extension --exec letsencrypt cli.php -d quivoto.cat -d www.quivoto.cat -m hola@quivoto.cat
```

## 6. Pujar el lloc

```bash
# des de l'arrel del projecte, a la teva màquina
python3 tools/build_landing.py          # assegura't que l'HTML és fresc

rsync -avz --delete \
  --exclude 'api/config.php' \
  web/public/ usuari@servidor:/var/www/vhosts/quivoto.cat/httpdocs/

# carpeta de dades FORA de l'arrel web
ssh usuari@servidor 'mkdir -p /var/www/vhosts/quivoto.cat/private/data && \
  chown -R usuari:psacln /var/www/vhosts/quivoto.cat/private && \
  chmod 750 /var/www/vhosts/quivoto.cat/private/data'
```

### Configuració del servidor
```bash
ssh usuari@servidor
cd /var/www/vhosts/quivoto.cat/httpdocs/api
cp config.example.php config.php
php -r 'echo bin2hex(random_bytes(24)), "\n";'   # copia la sal
nano config.php        # posa-hi la ruta de la base, la sal i, si vols, el correu d'avís
chmod 640 config.php
```

`config.php` ha de quedar així:
```php
return [
  'db'         => '/var/www/vhosts/quivoto.cat/private/data/quivoto.sqlite',
  'sal'        => '<la sal generada>',
  'avis_email' => 'hola@quivoto.cat',   // o '' per no rebre avisos
  'origens'    => ['https://quivoto.cat','https://www.quivoto.cat','https://quienvoto.es','https://www.quienvoto.es'],
];
```

L'usuari de PHP ha de poder escriure a `private/data/`. Si dona error 500 en enviar
el formulari, és això gairebé sempre: mira `logs/error_log` del vhost.

## 7. Comprovacions després de publicar

```bash
curl -sI https://quivoto.cat | head -3                       # 200 i HTTPS
curl -sI http://quivoto.cat | grep -i location                # redirecció a https
curl -sI https://www.quivoto.cat | grep -i location           # redirecció a sense www
curl -s https://quivoto.cat/assets/fonts.css | head -3        # tipografies locals
curl -s -H 'Accept: application/json' \
  -d 'email=prova@exemple.cat&lang=ca&consent=1' \
  https://quivoto.cat/api/subscribe.php                        # {"ok":true,...}
```

I a mà, al navegador:
- El formulari funciona **amb i sense JavaScript** (sense JS ha d'anar a `/gracies.html`).
- L'enllaç de baixa esborra l'adreça.
- Les cares parpellegen; amb «reduir moviment» activat, es queden quietes.
- `https://quivoto.cat/es/` mostra la versió en castellà.

Esborra la prova quan acabis:
```bash
sqlite3 /var/www/vhosts/quivoto.cat/private/data/quivoto.sqlite \
  "DELETE FROM subscriptors WHERE email='prova@exemple.cat';"
```

## 8. quienvoto.es

Mateix vhost o vhost separat, segons es prefereixi:

- **Mateix servidor, domini àlies**: afegir `quienvoto.es` com a domini a Plesk amb la
  mateixa arrel i fer que la portada serveixi `/es/index.html` (una regla de reescriptura),
  o bé un vhost propi amb el contingut de `web/public/es/`.
- Cal actualitzar `origens` a `config.php` (ja hi són tots dos dominis).

## 9. Còpies de seguretat

La llista de correus és l'únic que no es pot regenerar:

```bash
# a la corona (cron) de Plesk, un cop al dia
sqlite3 /var/www/vhosts/quivoto.cat/private/data/quivoto.sqlite \
  ".backup '/var/www/vhosts/quivoto.cat/private/data/copia-$(date +\%F).sqlite'"
find /var/www/vhosts/quivoto.cat/private/data -name 'copia-*.sqlite' -mtime +30 -delete
```

## 10. Abans de publicar de debò

- [ ] Omplir `[NOM DEL RESPONSABLE]`, `[NIF]`, `[ADREÇA]` i `[PROVEÏDOR D'ALLOTJAMENT]`
      a `privadesa.html` i `avis-legal.html` (i les versions en castellà).
- [ ] Crear la bústia `hola@quivoto.cat`.
- [ ] Comprovar i registrar `quienvoto.es`.
- [ ] Decidir si es registren `quivoto.com` i `quienvoto.com` com a defensius
      (comprovats lliures el 26-08-2026).
- [ ] Provar-ho en un mòbil de veritat.
