# Download app API

This document describes how the Download Festival app gets the lineup. The application can use this API as the lineup source for Download (ADR-0004, ADR-0007). The API is not documented. The information comes from the Android app, version 13.4.2 (`com.greencopper.android.downloadfestival`), and from requests on 19 November 2026.

## Source of the information

The app uses the Appmiral platform. The information comes from these classes and resources of the decompiled app:

| Item | Source in the app |
|---|---|
| Base address | String resource `api_url_v6`, read by `AppmiralApp.getApiUrl()` |
| Request headers | `com.appmiral.base.model.api.interceptor.HeaderInterceptor` and `Api.createRestAdapterBuilder` |
| Endpoints | `ArtistService`, `StageService` and `EditionService` |
| Paging | `PagedCall` and `ApiResult` |
| Fields | `Artist`, `Performance`, `Stage` and `EditionDate` |

## Requests

The base address is `https://app.appmiral.com/api/v7/`. The festival identifier is `downloadfestival`. The edition identifier is `downloadfestival2026`. The app has the two identifiers as string resources (`festivalRouteIdentifier` and `editionRouteIdentifier`), so an app update can change them.

| Data | Request |
|---|---|
| Edition, with the days | `GET events/downloadfestival/editions/downloadfestival2026` |
| Stages | `GET events/downloadfestival/editions/downloadfestival2026/stages?max_per_page=250` |
| Artists, with their performances | `GET events/downloadfestival/editions/downloadfestival2026/artists?include_related=true&max_per_page=250` |

The app adds `child_edition` to these requests only when its "select edition" module is on. The Download app does not use it.

## Authentication and headers

The lineup requests do not need a user account. The app sends these headers with each request:

| Header | Value |
|---|---|
| `x-protect` | The `x_Protect` string resource of the app. All installations of the app send the same value. |
| `Accept` | `application/json` |
| `Content-Type` | `application/json` |
| `Accept-Language` | The language of the device, for example `en` |
| `x-platform` | `android` |
| `x-app-version` | `13.4.2` |
| `x-os-version` | The Android API level, for example `35` |
| `x-event-identifier` | `downloadfestival` |
| `x-edition-identifier` | `downloadfestival2026` |
| `User-Agent` | `okhttp/4.12.0` |

The app sends `x-account-*` headers only to `https://app.appmiral.com/function/`, for tickets and user data. The application must not send requests to that address.

To get the `x-protect` value, decompile the resources of the app. The value is in `resources.arsc`, at resource ID `0x7f130aad` in version 13.4.2. Put the value in `.env` as `DOWNLOAD_APP_KEY`. Do not put it in the repository.

## Responses

Each list response has this structure: `{ "data": [...], "_links": { "self", "next", "prev" } }`. When `_links.next` exists, get that address for the next page. The artist list had two pages on 19 November 2026.

The artist list contains deleted artists. A deleted artist has only `id` and `deleted_at`. Ignore each artist that has `deleted_at` or that does not have `"published": true`.

| Object | Fields that the lineup source uses |
|---|---|
| Artist | `id`, `name`, `published`, `deleted_at`, `modified_at`, `performances` |
| Performance | `id`, `artist_id`, `stage_id`, `date_id`, `start_time`, `end_time`, `hide_start_time`, `hide_end_time`, `is_placeholder`, `deleted_at` |
| Stage | `id`, `name`, `published`, `deleted_at` |
| Day (`dates` in the edition) | `id`, `name`, `start_date`, `end_date` |

Each day starts at 05:00 UTC and ends at 05:00 UTC on the next day. A performance after midnight is therefore on the day before. The edition `timezone` is `Europe/London`.

The stage list also contains deleted stages (27 on 19 November 2026), campsites and car parks. Use only the stages that a performance refers to.

## Days, stages and set times

The API can give days, stages and set times. On 19 November 2026, no artist had a performance, so the lineup has artists only. Each artist gets performances when the festival publishes the timetable. The app code supports placeholder performances and hidden times, so a performance can exist without a start time.

## Change detection

These changes show that the API changed:

- A request gives a status other than 200. A new `x-protect` value or new identifiers in a new app version can cause this.
- A response does not have the structure or the fields in this document. The lineup source tests use the recorded responses in `test/fixtures/download-app/`. Record the responses again with `record.sh` and run the tests.
- A new app version has a different base address. The `v7` in the address is the API version.

To find a lineup change, compare `modified_at` and `deleted_at` of each artist with the lineup in the database.
