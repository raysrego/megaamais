# 📦 Configuração do Supabase Storage - Comprovantes PIX

## 🎯 Objetivo
Criar bucket para armazenar comprovantes de PIX anexados pelos operadores durante lançamentos de caixa.

---

## 📋 Passo a Passo

### 1. Acessar Dashboard do Supabase
**URL:** https://supabase.com/dashboard/project/[SEU_PROJECT_ID]/storage/buckets

### 2. Criar Novo Bucket

Click em **"New bucket"** e configure:

| Campo | Valor |
|-------|-------|
| **Name** | `comprovantes` |
| **Public bucket** | ✅ Marcado (Sim) |
| **File size limit** | `2 MB` (2097152 bytes) |
| **Allowed MIME types** | `image/jpeg, image/png, image/jpg` |

### 3. Configurar Políticas RLS (Automático via Migration)

As políticas já estão definidas na migration `20260203170000_refatoracao_fluxo_caixa.sql`:

```sql
-- Leitura pública
CREATE POLICY "Comprovantes públicos para leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'comprovantes');

-- Upload apenas autenticados
CREATE POLICY "Upload de comprovantes autenticado"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'comprovantes' 
    AND auth.role() = 'authenticated'
);

-- Delete apenas próprios arquivos
CREATE POLICY "Deletar próprios comprovantes"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'comprovantes' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## 🔧 Alternativa: Criar via SQL (se dashboard não funcionar)

Se preferir criar via SQL no Editor do Supabase:

```sql
-- Criar bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'comprovantes',
    'comprovantes',
    true,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/jpg']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
```

---

## ✅ Verificação

Após criar o bucket, teste:

1. **Via Dashboard:**
   - Acesse: Storage → comprovantes
   - Tente fazer upload manual de uma imagem
   - Deve funcionar se estiver autenticado

2. **Via Código:**
```typescript
const { data, error } = await supabase.storage
    .from('comprovantes')
    .list();

console.log('Bucket funciona:', !error);
```

---

## 🚨 Troubleshooting

### Erro: "Bucket not found"
- Verifique se o nome está exatamente como `comprovantes` (sem espaços)
- Confirme que criou no projeto correto

### Erro: "Permission denied"
- Execute a migration `20260203170000_refatoracao_fluxo_caixa.sql` para criar as políticas
- Verifique se está logado no sistema

### Erro: "File too large"
- Limite é 2MB
- Comprima a imagem antes de fazer upload

---

## 📁 Estrutura de Pastas

Os comprovantes serão salvos com esta estrutura:

```
comprovantes/
├── caixa/
│   ├── {sessao_id}/
│   │   ├── pix-1672531200000.jpg
│   │   ├── pix-1672531205000.jpg
│   │   └── ...
│   └── ...
└── ...
```

**Nomenclatura:** `pix-{timestamp}.jpg`

---

## 🔗 Referências

- [Docs Supabase Storage](https://supabase.com/docs/guides/storage)
- [RLS Policies](https://supabase.com/docs/guides/storage/security/access-control)
