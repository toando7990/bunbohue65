import { Helmet } from "react-helmet-async";

interface JsonLdProps {
  schema: object | object[];
}

export function JsonLd({ schema }: JsonLdProps) {
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}
