# SPA Fallback — Fix loi 404 khi refresh route con

Huong dan fix loi trang `/enterprise-delivery` (va cac route con khac) bao **404 Not Found** khi refresh truc tiep hoac truy cap qua URL.

---

## Nguyen nhan loi

Frontend dung **TanStack Router** o **history mode** (`createBrowserHistory` mac dinh), khong phai hash mode.

| Truong hop | URL | Nginx xu ly | Ket qua |
|---|---|---|---|
| Truy cap trang chu | `https://www.bunbohue65.vn/` | Phuc vu `/var/www/bunbohue65/dist/index.html` | 200 OK |
| Click link trong app | `https://www.bunbohue65.vn/enterprise-delivery` | TanStack Router xu ly phia client (khong goi server) | 200 OK |
| **Refresh / truy cap truc tiep** | `https://www.bunbohue65.vn/enterprise-delivery` | Nginx tim file `/var/www/bunbohue65/dist/enterprise-delivery` -> **khong ton tai** | **404 Not Found** |

Vite build ra `dist/` tinh: chi co `index.html` + cac file trong `assets/`. Khong co file vat ly cho tung route. Khi Nginx nhan request `GET /enterprise-delivery`, no tim file tinh tuong ung, khong thay -> tra 404.

---

## Giai phap: `try_files` fallback

Them chi thi sau vao `location /` block trong cau hinh Nginx:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**Cach hoat dong:**

1. `$uri` — Tim file tinh theo URL (vd: `/assets/index-abc.js` -> tim file vat ly)
2. `$uri/` — Neu la thu muc, tim `index.html` trong do
3. `/index.html` — **Fallback**: Khong tim thay file tinh, tra `index.html` (file SPA chinh). Trinh duyet tai `index.html`, TanStack Router phan tich URL va render dung route.

=> Moi route con deu tra `index.html` (HTTP 200), de SPA xu ly phia client.

---

## Cach ap dung

> **Luu y — nhieu server block:** Neu VPS co nhieu server block (vd: phuc vu nhieu domain), ban PHAI xac dinh server block nao dang phuc vu `bunbohue65.vn` truoc khi chay script. Script mac dinh chi sua `/etc/nginx/sites-enabled/bunbohue65-proxy`. Neu file nay khong phai file Nginx thuc su load cho `bunbohue65.vn`, thay doi se khong co hieu luc.
>
> Kiem tra server block nao dang phuc vu `bunbohue65.vn`:
> ```bash
> ssh root@103.149.170.47
> nginx -T | grep -B5 -A15 "server_name.*bunbohue65"
> ```
> Neu file that khac `bunbohue65-proxy`, cap nhat `NGINX_CONF` trong script hoac sua file do thu cong theo Cach 2.

### Cach 1 — Tu dong (khuyen nghi)

Chay script tu may tinh ca nhan (can SSH key hoac password VPS):

```bash
chmod +x scripts/setup-spa-fallback.sh
./scripts/setup-spa-fallback.sh
```

Script se:
1. Kiem tra file `/etc/nginx/sites-enabled/bunbohue65-proxy` co ton tai tren VPS
2. Backup file hien tai (vd: `bunbohue65-proxy.bak.20260630-153000`)
3. Kiem tra xem `try_files ... /index.html` da co chua -> neu co thi SKIP
4. Them `try_files $uri $uri/ /index.html;` vao `location /` block (chi them, khong ghi de)
5. Test `nginx -t` voi cau hinh moi -> neu FAIL thi rollback backup
6. Reload nginx neu test PASS
7. Kiem tra route `/enterprise-delivery` tra HTTP 200

**Script AN TOAN:**
- Khong ghi de cau hinh hien co — chi them 1 dong `try_files`
- Backup truoc khi thay doi
- Rollback tu dong neu `nginx -t` FAIL
- Khong reload neu test fail

### Cach 2 — Thu cong

#### Buoc 1 — SSH vao VPS

```bash
ssh root@103.149.170.47
```

#### Buoc 2 — Backup file nginx

```bash
cp /etc/nginx/sites-enabled/bunbohue65-proxy \
   /etc/nginx/sites-enabled/bunbohue65-proxy.bak.$(date +%Y%m%d-%H%M%S)
```

#### Buoc 3 — Them try_files vao location / block

Mo file:

```bash
nano /etc/nginx/sites-enabled/bunbohue65-proxy
```

Tim `location /` block (hoac them moi neu chua co), dam bao co:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Dat block nay **BEN TRONG** `server { ... }` block (port 443).

#### Buoc 4 — Test va reload

```bash
nginx -t
# Neu hien "syntax is ok" + "test is successful":

systemctl reload nginx
```

Neu `nginx -t` FAIL:
```bash
# Rollback
cp /etc/nginx/sites-enabled/bunbohue65-proxy.bak.* /etc/nginx/sites-enabled/bunbohue65-proxy
```

#### Buoc 5 — Kiem tra

```bash
# Tu VPS
curl -I https://www.bunbohue65.vn/enterprise-delivery
# Phai tra: HTTP/1.1 200 OK

# Tu may tinh ca nhan
curl -I https://www.bunbohue65.vn/enterprise-delivery
```

---

## Cau hinh mau day du

Xem file `scripts/nginx-spa-fallback.conf` de lay server block mau day du, bao gom:

- HTTP -> HTTPS redirect (port 80)
- HTTPS server block (port 443) voi SSL
- `root` tro toi `dist/` (doi path cho dung VPS)
- `gzip` cho assets
- `location /` voi `try_files` fallback (chi thi chinh)
- `location /assets/` cache 1 nam (Vite them hash vao ten file)
- `location = /robots.txt` va `location = /sitemap.xml`
- `location /api/` proxy_pass toi backend canister (placeholder)
- `include /etc/nginx/snippets/ahamove-worker.conf;` (neu da co)
- Bao mat headers (HSTS, X-Frame-Options, ...)
- `error_page 404 /index.html;` (fallback them cho an toan)

---

## Rollback

Neu sau khi ap dung ma website bi loi:

```bash
ssh root@103.149.170.47

# Tim file backup moi nhat
ls -lt /etc/nginx/sites-enabled/bunbohue65-proxy.bak.* | head -5

# Rollback
cp /etc/nginx/sites-enabled/bunbohue65-proxy.bak.20260630-153000 \
   /etc/nginx/sites-enabled/bunbohue65-proxy

nginx -t && systemctl reload nginx
```

---

## Cac route con can kiem tra sau khi fix

| Route | Mo ta |
|---|---|
| `/enterprise-delivery` | Giao hang doanh nghiep (route gay loi 404) |
| `/accounting-view` | Xem ke toan |
| `/customer-support` | Ho tro khach hang |
| `/activate-device` | Kich hoat thiet bi |
| `/admin/master-menu` | Menu tong (admin) |
| `/HoaDondemo` | Hoa don demo |
| `/` | Trang chu |

Test tat ca: refresh tung route, phai tra 200 va hien dung noi dung.

### Lenh curl kiem tra tung route

```bash
# Tu may tinh ca nhan (hoac tu VPS, doi host thanh localhost)
curl -I https://www.bunbohue65.vn/enterprise-delivery
curl -I https://www.bunbohue65.vn/accounting-view
curl -I https://www.bunbohue65.vn/customer-support
curl -I https://www.bunbohue65.vn/activate-device
curl -I https://www.bunbohue65.vn/admin/master-menu
curl -I https://www.bunbohue65.vn/HoaDondemo
```

Tat ca phai tra `HTTP/1.1 200 OK` (hoac `HTTP/2 200`).

### Kiem tra nhanh tat ca route bang vong lap

```bash
for r in /enterprise-delivery /accounting-view /customer-support \
         /activate-device /admin/master-menu /HoaDondemo; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -I "https://www.bunbohue65.vn${r}")
  echo "$code  $r"
done
```

> Script `setup-spa-fallback.sh` da tu dong kiem tra tat ca cac route nay o buoc cuoi va in bang tong ket.

---

## Troubleshooting

Cac truong hop loi thuong gap khi ap dung SPA fallback va cach xu ly.

### 1. `nginx -t` FAIL sau khi chinh sua

**Hien tuong:** Chay `nginx -t` bao loi syntax (vd: `unexpected "}"`, `unknown directive`).

**Nguyen nhan:** Chen `try_files` lam hong cu phap (vd: thieu dau cham phay, chen sai vi tri).

**Cach xu ly — rollback tu backup:**

```bash
ssh root@103.149.170.47

# Tim file backup moi nhat
ls -lt /etc/nginx/sites-enabled/bunbohue65-proxy.bak.* | head -5

# Rollback (doi timestamp dung)
cp /etc/nginx/sites-enabled/bunbohue65-proxy.bak.20260630-153000 \
   /etc/nginx/sites-enabled/bunbohue65-proxy

# Test lai
nginx -t
# Neu OK:
systemctl reload nginx
```

Script tu dong rollback neu `nginx -t` FAIL sau khi ghi de, nhung neu chinh sua thu cong thi phai rollback bang tay.

### 2. `curl` van tra 404 sau khi reload

**Hien tuong:** Da reload nginx nhung `curl -I https://www.bunbohue65.vn/enterprise-delivery` van tra `404 Not Found`.

**Nguyen nhan va cach kiem tra:**

| Nguyen nhan | Cach kiem tra | Cach fix |
|---|---|---|
| File da chinh khong phai file Nginx load | `nginx -T \| grep -A20 "server_name bunbohue65"` xem `try_files` co xuat hien khong | Chinh file that (xem `nginx -T`), hoac cap nhat `NGINX_CONF` trong script |
| `root` sai path | `nginx -T \| grep -A5 "server_name bunbohue65"` xem `root` | Doi `root` tro toi `/var/www/bunbohue65/dist` (hoac path dist that) |
| Co nhieu server block, file chinh khong phai file phuc vu | `nginx -T \| grep -B2 -A15 "server_name.*bunbohue65"` | Xac dinh server block that, chinh block do |
| Nginx chua reload | `systemctl status nginx` xem `active` va `last reload` | `systemctl reload nginx` |
| Cache CDN / Cloudflare | Test tu VPS: `curl -I http://localhost/enterprise-delivery -H "Host: www.bunbohue65.vn"` | Xoa cache CDN hoac cho doi cache TTL |

Lenh kiem tra tong quat:

```bash
ssh root@103.149.170.47
# Xem toan bo cau hinh Nginx dang load, loc cho bunbohue65
nginx -T 2>/dev/null | grep -B2 -A20 "server_name.*bunbohue65"
# Kiem tra try_files co trong cau hinh that khong
nginx -T 2>/dev/null | grep "try_files"
```

### 3. `curl` tra 200 nhung trang trang (blank page)

**Hien tuong:** `curl -I` tra `HTTP/1.1 200 OK` nhung mo trinh duyet thi trang trang hoac bao loi JS.

**Nguyen nhan:** `dist/` chua duoc deploy len VPS, hoac `root` tro sai thu muc. Nginx tra `index.html` nhung file rong hoac khong ton tai.

**Cach kiem tra:**

```bash
ssh root@103.149.170.47

# Kiem tra dist co file index.html khong
ls -la /var/www/bunbohue65/dist/index.html

# Kiem tra noi dung index.html (phai co <div id="root">)
head -20 /var/www/bunbohue65/dist/index.html

# Kiem tra assets/ co file JS/CSS khong
ls /var/www/bunbohue65/dist/assets/ | head -10
```

**Cach fix:** Build frontend (`pnpm build` trong `src/frontend/`) va deploy `dist/` len `/var/www/bunbohue65/dist/`:

```bash
# Tu may tinh ca nhan
cd src/frontend && pnpm build
rsync -avz --delete dist/ root@103.149.170.47:/var/www/bunbohue65/dist/
```

### 4. Permission denied khi SSH

**Hien tuong:** `ssh root@103.149.170.47` bao `Permission denied (publickey,password)`.

**Nguyen nhan va cach fix:**

| Nguyen nhan | Cach fix |
|---|---|
| Khong co SSH key cho VPS | Them key: `ssh-copy-id root@103.149.170.47` (can password lan dau) |
| SSH key sai file | Chi dinh key: `ssh -i ~/.ssh/id_rsa_vps root@103.149.170.47` |
| VPS khong cho phep root login | Kiem tra `/etc/ssh/sshd_config` co `PermitRootLogin yes`; hoac dung user khac roi `sudo` |
| Firewall chan port 22 | Mo port 22 tren firewall VPS (FPT portal hoac `ufw allow 22`) |

**Kiem tra ket noi SSH:**

```bash
ssh -v root@103.149.170.47
# -v se in log chi tiet de biet bi chan o buoc nao
```

### 5. Script bao "Khong tim thay location / block"

**Hien tuong:** Script thoat voi loi `Khong tim thay location / block. Can them thu cong`.

**Nguyen nhan:** File nginx co `server` block nhung chua co `location /` block (vd: chi co cac `location /api/`, `location /assets/` cu the).

**Cach fix:** Them thu cong `location /` block vao BEN TRONG `server { ... }` block (port 443):

```bash
ssh root@103.149.170.47
nano /etc/nginx/sites-enabled/bunbohue65-proxy
```

Them vao (dat truoc cac `location` cu the khac):

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Sau do:

```bash
nginx -t && systemctl reload nginx
```

---

## Cau hoi thuong gap

### Q: Tai sao khong dung hash mode (#/enterprise-delivery)?

A: Hash mode khong dep SEO, khong tuong thich voi mot so service ben ngoai (vd: AhaMove webhook can URL sach). History mode dep hon va la mac dinh cua TanStack Router. Chi can them `try_files` fallback la fix duoc loi 404.

### Q: Script co anh huong den cac worker (AhaMove, BKAV) khong?

A: KHONG. Script chi them `try_files` vao `location /` block. Cac route worker (`/ahamove-health`, `/ahamove-book`, ...) nam trong `location` block rieng, khong bi anh huong. Nginx match `location` cu the truoc `location /`, nen cac route worker van hoat dong binh thuong.

### Q: Neu da co `try_files` khac trong `location /` thi sao?

A: Script kiem tra truoc — neu da co `try_files ... /index.html` thi SKIP, khong thay doi gi. Neu co `try_files` khac (khong co `/index.html`), can xem xet thu cong de gop lai.

### Q: Cache trinh duyet co anh huong khong?

A: Sau khi reload nginx, co the can **Ctrl+Shift+R** (hard refresh) hoac xoa cache trinh duyet de thay ket qua. Nginx khong cache `index.html` (chi cache `assets/`), nen route con se lay `index.html` moi nhat.

---

## File lien quan

| File | Mo ta |
|---|---|
| `scripts/nginx-spa-fallback.conf` | Cau hinh Nginx server block mau day du |
| `scripts/setup-spa-fallback.sh` | Script tu dong ap dung try_files fallback |
| `scripts/nginx-config-snippet.txt` | Snippet nginx cho AhaMove Worker (lien quan, khong bi anh huong) |
| `scripts/README-AHAMOVE-WORKER.md` | Huong dan trien khai AhaMove Worker |

---

## Tom tat

| Buoc | Lenh |
|---|---|
| 1. Ap dung tu dong | `./scripts/setup-spa-fallback.sh` |
| 2. Kiem tra | `curl -I https://www.bunbohue65.vn/enterprise-delivery` |
| 3. Ket qua mong muon | `HTTP/1.1 200 OK` |
| 4. Rollback neu loi | `cp <backup> /etc/nginx/sites-enabled/bunbohue65-proxy && systemctl reload nginx` |

---

*© 2026. Built with love using [caffeine.ai](https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=tableorder)*
