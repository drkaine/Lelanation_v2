# API Contracts - Backend

## Overview
RESTful API endpoints for Lelanation backend. All endpoints are prefixed with `/api/`.

## Authentication
No authentication required (stateless API).

## Cache Strategy
- Most GET endpoints use Redis cache with configurable TTL
- Cache invalidation on POST/PUT/DELETE operations
- Cache headers: `X-Cache`, `X-Cache-Key`, `X-Cache-Invalidated`

## Endpoints

### Analytics

#### GET `/api/analytics`
Get analytics data.

**Cache**: TTL 60s (short-lived)

**Response**: Analytics data object

---

#### POST `/api/analytics`
Save analytics data.

**Cache**: Invalidates `analytics:*`

**Request Body**: Analytics data object

**Response**: 200 OK

---

### Builds

#### GET `/api/builds`
Get all builds.

**Cache**: TTL 300s (5 minutes)

**Query Parameters**:
- `nocache` (optional): Bypass cache if `true`

**Response**: Array of build objects

---

#### GET `/api/builds/lelariva`
Get all Lelariva builds.

**Cache**: TTL 300s (5 minutes)

**Query Parameters**:
- `nocache` (optional): Bypass cache if `true`

**Response**: Array of Lelariva build objects

---

#### GET `/api/build/:fileName`
Get a specific build by filename.

**Cache**: TTL 3600s (1 hour), key: `builds:{fileName}`

**Path Parameters**:
- `fileName`: Build filename

**Query Parameters**:
- `nocache` (optional): Bypass cache if `true`

**Response**: Build object

---

#### GET `/api/build/lelariva/:fileName`
Get a specific Lelariva build by filename.

**Cache**: TTL 3600s (1 hour), key: `builds:lelariva:{fileName}`

**Path Parameters**:
- `fileName`: Build filename

**Query Parameters**:
- `nocache` (optional): Bypass cache if `true`

**Response**: Lelariva build object

---

#### POST `/api/save/:filename`
Save a new build.

**Cache**: Invalidates `builds:*`

**Path Parameters**:
- `filename`: Build filename

**Request Body**: Build data object (JSON)

**Response**: 200 OK

---

#### POST `/api/save/lelariva/:filename`
Save a new Lelariva build.

**Cache**: Invalidates `builds:lelariva:*`

**Path Parameters**:
- `filename`: Build filename

**Request Body**: Lelariva build data object (JSON)

**Response**: 200 OK

---

#### PUT `/api/update/:filename`
Update an existing build.

**Cache**: Invalidates `builds:*` and `cache:/api/builds`

**Path Parameters**:
- `filename`: Build filename

**Request Body**: Updated build data object (JSON)

**Response**: 200 OK

---

#### PUT `/api/update/lelariva/:filename`
Update an existing Lelariva build.

**Cache**: Invalidates `builds:lelariva:*` and `cache:/api/builds/lelariva`

**Path Parameters**:
- `filename`: Build filename

**Request Body**: Updated Lelariva build data object (JSON)

**Response**: 200 OK

---

#### DELETE `/api/build/:fileName`
Delete a build.

**Cache**: Invalidates `builds:*`

**Path Parameters**:
- `fileName`: Build filename

**Response**: 200 OK with message "Build supprimé"

---

#### DELETE `/api/build/lelariva/:fileName`
Delete a Lelariva build.

**Cache**: Invalidates `builds:lelariva:*`

**Path Parameters**:
- `fileName`: Build filename

**Response**: 200 OK with message "Build supprimé"

---

### Dictionnaire (Dictionary)

#### GET `/api/dictionnaire`
Get dictionary entries.

**Cache**: TTL 3600s (1 hour)

**Response**: Dictionary data object

---

#### POST `/api/dictionnaire`
Save dictionary entry.

**Cache**: Invalidates `dictionnaire:*`

**Request Body**: Dictionary entry object

**Response**: 200 OK

---

#### POST `/api/dictionnaire/approve`
Approve a dictionary entry.

**Cache**: Invalidates `dictionnaire:*`

**Request Body**: Approval data

**Response**: 200 OK

---

#### POST `/api/dictionnaire/reject`
Reject a dictionary entry.

**Cache**: Invalidates `dictionnaire:*`

**Request Body**: Rejection data

**Response**: 200 OK

---

### Contact

#### GET `/api/contact`
Get contact messages.

**Cache**: TTL 300s (5 minutes)

**Response**: Array of contact messages

---

#### POST `/api/contact`
Send contact message.

**Cache**: Invalidates `contact:*`

**Request Body**: Contact form data

**Response**: 200 OK

---

### Tier List

#### GET `/api/tierlist/all`
Get all tier lists.

**Cache**: TTL 1800s (30 minutes)

**Response**: Array of tier list objects

---

#### POST `/api/tierlist/upload/:nameFolder`
Upload a tier list file.

**Cache**: Invalidates `tierlist:*`

**Path Parameters**:
- `nameFolder`: Folder name for the tier list

**Request**: Multipart form data with file

**Response**: 200 OK

---

#### PUT `/api/tierlist/:category/:fileName`
Toggle tier list visibility.

**Cache**: Invalidates `tierlist:*`

**Path Parameters**:
- `category`: Tier list category
- `fileName`: Tier list filename

**Response**: 200 OK

---

#### DELETE `/api/tierlist/:category/:fileName`
Delete a tier list.

**Cache**: Invalidates `tierlist:*`

**Path Parameters**:
- `category`: Tier list category
- `fileName`: Tier list filename

**Response**: 200 OK

---

### Assets

#### GET `/api/assets/list`
List asset files.

**Response**: Array of asset file information

---

### Metrics

#### GET `/api/metrics/cache`
Get cache metrics.

**Response**: Cache statistics object

---

#### POST `/api/metrics/cache/reset`
Reset cache metrics.

**Response**: 200 OK

---

### Health & Status

#### GET `/api/health`
Health check endpoint.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

---

#### GET `/api/status`
Detailed server status.

**Response**:
```json
{
  "status": "ok",
  "redis": {
    "connected": true,
    "status": "ready"
  },
  "uptime": 12345.67,
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

---

## Static Assets

### GET `/static/*`
Static assets (if `SERVE_STATIC=true`).

**Cache**: 24 hours

---

### GET `/data/*`
JSON data files.

**Cache**: 1 hour

---

## Error Handling
- 200: Success
- 500: Server error
- Error messages in French

## Rate Limiting
Not implemented (consider for production).

## CORS
Configured via `config.cors` in backend configuration.
