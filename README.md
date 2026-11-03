# Sophia Glow na VPS (Locaweb)

Antes: você precisa de (a) acesso SSH root à VPS com Ubuntu ou Debian, (b) um domínio ou subdomínio apontando para o IP da VPS (registro "A" no painel de DNS), e (c) conta no Mercado Pago com o Access Token (Suas integrações). Sem domínio não dá para ter HTTPS, e o Mercado Pago só avisa pagamentos em endereço HTTPS.
No painel da Locaweb, libere as portas 80 e 443 no firewall da VPS.

## 1. Preparar a VPS (uma vez)
    ssh root@IP_DA_VPS
    apt update && apt install -y nginx certbot python3-certbot-nginx curl unzip
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs

## 2. Enviar e instalar (no seu computador, depois na VPS)
    scp sophia-glow-vps.zip root@IP_DA_VPS:/opt/
    ssh root@IP_DA_VPS
    cd /opt && unzip sophia-glow-vps.zip -d sophia-glow && cd sophia-glow
    npm install --omit=dev
    cp .env.example .env && nano .env      # PIN, token e https://SEU_DOMINIO
    chown -R www-data:www-data /opt/sophia-glow && chmod 600 .env

## 3. Ligar o servidor
    cp deploy/sophia-glow.service /etc/systemd/system/
    systemctl daemon-reload && systemctl enable --now sophia-glow
    systemctl status sophia-glow           # deve aparecer "active (running)"

## 4. Site com HTTPS
    cp deploy/nginx.conf /etc/nginx/sites-available/sophia-glow
    sed -i 's/SEU_DOMINIO/loja.seudominio.com.br/' /etc/nginx/sites-available/sophia-glow
    ln -s /etc/nginx/sites-available/sophia-glow /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    certbot --nginx -d loja.seudominio.com.br

Abra https://loja.seudominio.com.br: a loja deve aparecer. Entre em "Minha loja" com o PIN do .env.

## 5. Cópia de segurança (recomendado)
    crontab -e   # adicione:
    0 3 * * * cp /opt/sophia-glow/data.json /opt/sophia-glow/backup-$(date +\%u).json

## 6. APK
1. Em `public/config.js`, coloque `window.API_BASE="https://loja.seudominio.com.br";`
2. Suba esta pasta num repositório do GitHub, rode Actions > "Gerar APK" e baixe o arquivo.

## Notificações no celular (opcional)
O painel já atualiza sozinho a cada 15 segundos. Para push de verdade no APK: crie um projeto grátis no Firebase (não precisa de cartão), baixe a chave de conta de serviço, salve como `firebase-key.json` na pasta do servidor, rode `npm install` e `systemctl restart sophia-glow`. Coloque também o `google-services.json` do app Android em `android/app/` antes de gerar o APK.

## Atualizar depois
Envie os arquivos novos, `systemctl restart sophia-glow`. Os produtos ficam em `data.json` (não apague).


## APK de teste offline (sem domínio ou VPS)
Esta edição foi preparada para abrir como aplicativo Android sem servidor:
- Produtos de demonstração já aparecem na vitrine.
- O painel local usa o PIN `1234`.
- É possível cadastrar/remover produtos e simular compras.
- O botão "Simular pagamento" apenas demonstra o fluxo; não movimenta dinheiro nem gera Pix real.
- Os dados de teste ficam salvos no armazenamento local do aplicativo.

### Gerar o APK
1. Crie um repositório no GitHub e envie todos os arquivos desta pasta.
2. Abra a aba **Actions** e escolha **Gerar APK**.
3. Clique em **Run workflow**.
4. Quando terminar, abra a execução e baixe o artefato **sophia-glow-apk**.
5. No Android, instale `app-debug.apk` (talvez seja necessário permitir instalação dessa origem).

O APK debug é para testes, não para publicação na Play Store. Quando houver domínio/servidor, configure `window.API_BASE` em `public/config.js` e gere uma nova versão conectada.
