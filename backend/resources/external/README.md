# Recursos externos en PDF

La descarga de PDFs se gestiona desde `GET /api/resources/external/:fileName`.

El backend comprueba si el PDF existe en Cloudinary y, si está disponible, entrega una URL firmada de descarga. Si todavía no está subido a Cloudinary, usa este directorio como fallback local.

Para subir o actualizar los PDFs activos:

```bash
npm run resources:upload
```

Con el plan actual de Cloudinary, los archivos raw de más de 10 MB no se pueden subir. Esos PDFs deben comprimirse, dividirse o subirse con un plan que permita archivos mayores antes de poder retirar el fallback local.
