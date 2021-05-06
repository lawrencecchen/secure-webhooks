# secure-webhooks

Useful for securing webhooks.

## Usage

On the webhook sender:

```ts
import { symmetric } from "secure-webhooks"

const secret = "some shared secret"
const payload = "...";

const signature = symmetric.sign(payload, secret);

sendToWebhookReceiver({
  body: payload,
  headers: {
    "x-webhook-signature": signature
    ...
  }
})
```

On the webhook receiver:

```ts
import { symmetric } from "secure-webhooks"

const secret = "some shared secret" // the same as above

app.post("/webhook-endpoint", (req, res) => {
  const isTrustWorthy = symmetric.verify(
    req.body, // 👈 needs to be exactly the same as above, make sure to disable any body parsing for this route
    secret,
    req.headers["x-webhook-signature"]
  )

  if (!isTrustWorthy) {
    res.status(401).end("Not Authorized")
    return
  }

  ...
})
```

Same works with asymmetric mode:

```ts
import { asymmetric } from "secure-webhooks"
```
