import type { ContentType, ExamWithQuestions, Resource, Subject } from '@thanaya/types';

/**
 * Centralized GEO (Generative Engine Optimization) layer.
 *
 * This module is the single source of truth for the platform's entity identity
 * and for the structured data emitted on every page. All values are derived from
 * real database fields (subject, content_type, week, dates, title, description),
 * so any content published from the Admin panel automatically receives the
 * correct metadata and entity relationships at render time — with no manual
 * code changes required.
 */

export type JsonLd = Record<string, any>;

const RAW_SITE = (import.meta.env?.SITE as string | undefined) || 'https://thanaya.dpdns.org';
const SITE = RAW_SITE.replace(/\/+$/, '');

// ---- Entity identity (single canonical source) ----

/** Primary entity name. Must stay consistent across every schema and meta tag. */
export const PLATFORM_NAME = 'منصة ثنايا';

/** Contextual aliases used by search engines and AI to disambiguate the entity. */
export const PLATFORM_ALTERNATE_NAMES = ['ثنايا', 'منصة ثنايا البكالوريا', 'Thanaya'];

/** Reflects the current reality of the platform: second-year baccalaureate only. */
export const PLATFORM_DESCRIPTION =
  'منصة ثنايا هي منصة تعليمية مصرية مخصصة حاليًا لطلاب تانية بكالوريا، وتوفّر التدريبات والامتحانات والتقييمات الأسبوعية وحلولها والملخصات والكتب.';

/** The single grade level the platform currently serves. */
export const EDUCATIONAL_LEVEL = 'تانية بكالوريا';

export const LOCALE = 'ar-EG';

export const ORG_ID = `${SITE}/#organization`;
export const WEBSITE_ID = `${SITE}/#website`;

// ---- URL helpers ----

export function absoluteUrl(path: string): string {
  if (!path) return SITE;
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, `${SITE}/`).href;
}

export function subjectUrl(slug: string): string {
  return absoluteUrl(`/subjects/${slug}`);
}

export function contentTypeUrl(subjectSlug: string, contentTypeSlug: string): string {
  return absoluteUrl(`/subjects/${subjectSlug}/${contentTypeSlug}`);
}

export function resourceUrl(slug: string): string {
  return absoluteUrl(`/resources/${slug}`);
}

export function examUrl(id: string): string {
  return absoluteUrl(`/exams/${id}`);
}

// ---- Shared entity fragments ----

function organizationRef(): JsonLd {
  return { '@id': ORG_ID };
}

function websiteRef(): JsonLd {
  return { '@type': 'WebSite', '@id': WEBSITE_ID };
}

function subjectEntity(subject?: Subject | null): JsonLd | undefined {
  if (!subject) return undefined;
  return {
    '@type': 'Thing',
    name: subject.name,
    url: subjectUrl(subject.slug),
  };
}

function educationalAudience(): JsonLd {
  return {
    '@type': 'EducationalAudience',
    educationalRole: 'student',
    audienceType: EDUCATIONAL_LEVEL,
  };
}

// ---- Global schemas (rendered once in Layout) ----

export function buildOrganizationSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'EducationalOrganization'],
    '@id': ORG_ID,
    name: PLATFORM_NAME,
    alternateName: PLATFORM_ALTERNATE_NAMES,
    url: SITE,
    description: PLATFORM_DESCRIPTION,
    inLanguage: LOCALE,
    areaServed: { '@type': 'Country', name: 'مصر' },
  };
}

export function buildWebSiteSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: PLATFORM_NAME,
    alternateName: PLATFORM_ALTERNATE_NAMES,
    url: SITE,
    description: PLATFORM_DESCRIPTION,
    inLanguage: LOCALE,
    publisher: organizationRef(),
  };
}

// ---- Breadcrumbs (auto-built per page type) ----

export interface BreadcrumbEntry {
  name: string;
  url?: string;
}

export function buildBreadcrumbList(trail: BreadcrumbEntry[]): JsonLd {
  const entries: BreadcrumbEntry[] = [{ name: 'الرئيسية', url: absoluteUrl('/') }, ...trail];

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      ...(entry.url ? { item: entry.url } : {}),
    })),
  };
}

// ---- Per-type page schemas ----

function buildHomeSchema(resources: Resource[]): JsonLd {
  const pageUrl = absoluteUrl('/');
  const schema: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#collection`,
    url: pageUrl,
    name: PLATFORM_NAME,
    description: PLATFORM_DESCRIPTION,
    inLanguage: LOCALE,
    isPartOf: websiteRef(),
    about: organizationRef(),
    mainEntity: organizationRef(),
  };

  if (resources.length > 0) {
    schema.hasPart = resources.map((resource) => ({
      '@type': 'LearningResource',
      name: resource.title,
      url: resourceUrl(resource.slug),
      ...(resource.content_type ? { learningResourceType: resource.content_type.name } : {}),
    }));
  }

  return schema;
}

function buildSubjectCollectionSchema(subject: Subject, contentTypes?: ContentType[]): JsonLd {
  const pageUrl = subjectUrl(subject.slug);
  const schema: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#collection`,
    url: pageUrl,
    name: subject.name,
    inLanguage: LOCALE,
    isPartOf: websiteRef(),
    about: subjectEntity(subject),
    provider: organizationRef(),
  };

  if (subject.description) schema.description = subject.description;

  if (contentTypes && contentTypes.length > 0) {
    schema.hasPart = contentTypes.map((contentType) => ({
      '@type': 'CollectionPage',
      '@id': `${contentTypeUrl(subject.slug, contentType.slug)}#collection`,
      name: contentType.name,
      url: contentTypeUrl(subject.slug, contentType.slug),
      isPartOf: { '@id': `${pageUrl}#collection` },
    }));
  }

  return schema;
}

function buildSubjectListingSchema(subjects: Subject[]): JsonLd {
  const pageUrl = absoluteUrl('/subjects');
  const schema: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#collection`,
    url: pageUrl,
    name: 'المواد الدراسية',
    description: `قائمة المواد الدراسية المتاحة لطلاب ${EDUCATIONAL_LEVEL} على ${PLATFORM_NAME}.`,
    inLanguage: LOCALE,
    isPartOf: websiteRef(),
    provider: organizationRef(),
  };

  if (subjects.length > 0) {
    schema.hasPart = subjects.map((subject) => ({
      '@type': 'CollectionPage',
      '@id': `${subjectUrl(subject.slug)}#collection`,
      name: subject.name,
      url: subjectUrl(subject.slug),
      ...(subject.description ? { description: subject.description } : {}),
    }));
  }

  return schema;
}

function buildContentTypeCollectionSchema(
  subject: Subject,
  contentType: ContentType,
  resources: Resource[]
): JsonLd {
  const pageUrl = contentTypeUrl(subject.slug, contentType.slug);
  const schema: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#collection`,
    url: pageUrl,
    name: `${contentType.name} في ${subject.name}`,
    inLanguage: LOCALE,
    isPartOf: [
      websiteRef(),
      {
        '@type': 'CollectionPage',
        '@id': `${subjectUrl(subject.slug)}#collection`,
        url: subjectUrl(subject.slug),
      },
    ],
    about: subjectEntity(subject),
    provider: organizationRef(),
  };

  const description = contentType.description || subject.description;
  if (description) schema.description = description;

  if (resources.length > 0) {
    schema.hasPart = resources.map((resource) => ({
      '@type': 'LearningResource',
      name: resource.title,
      url: resourceUrl(resource.slug),
    }));
  }

  return schema;
}

function buildLearningResourceSchema(resource: Resource, descriptionOverride?: string): JsonLd {
  const pageUrl = resourceUrl(resource.slug);
  const subject = resource.subject;
  const contentType = resource.content_type;

  const schema: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    '@id': `${pageUrl}#resource`,
    name: resource.title,
    url: pageUrl,
    inLanguage: LOCALE,
    educationalLevel: EDUCATIONAL_LEVEL,
    learningResourceType: contentType?.name || 'مورد تعليمي',
    isAccessibleForFree: true,
    provider: organizationRef(),
    publisher: organizationRef(),
    audience: educationalAudience(),
    isPartOf: [websiteRef()],
  };

  const description = descriptionOverride || resource.description;
  if (description) schema.description = description;
  if (subject) {
    schema.about = subjectEntity(subject);
    schema.isPartOf.push({
      '@type': 'CollectionPage',
      '@id': `${subjectUrl(subject.slug)}#collection`,
      url: subjectUrl(subject.slug),
    });
    if (contentType) {
      schema.isPartOf.push({
        '@type': 'CollectionPage',
        '@id': `${contentTypeUrl(subject.slug, contentType.slug)}#collection`,
        url: contentTypeUrl(subject.slug, contentType.slug),
      });
    }
  }
  if (resource.week) {
    schema.mentions = { '@type': 'Thing', name: resource.week.title };
  }
  if (resource.published_at || resource.created_at) {
    schema.datePublished = resource.published_at || resource.created_at;
  }
  if (resource.updated_at || resource.created_at) {
    schema.dateModified = resource.updated_at || resource.created_at;
  }
  if (resource.youtube_url) {
    schema.video = {
      '@type': 'VideoObject',
      name: `فيديو شرح: ${resource.title}`,
      url: resource.youtube_url,
    };
  }

  return schema;
}

function buildExamListingSchema(subject: Subject | null | undefined, exams: ExamWithQuestions[]): JsonLd {
  const pageUrl = absoluteUrl('/exams');
  const schema: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#collection`,
    url: pageUrl,
    name: subject ? `امتحانات تفاعلية في ${subject.name}` : 'الامتحانات التجريبية التفاعلية',
    inLanguage: LOCALE,
    isPartOf: subject
      ? [
          websiteRef(),
          {
            '@type': 'CollectionPage',
            '@id': `${subjectUrl(subject.slug)}#collection`,
            url: subjectUrl(subject.slug),
          },
        ]
      : websiteRef(),
    about: subject ? subjectEntity(subject) : organizationRef(),
    provider: organizationRef(),
  };

  if (exams.length > 0) {
    schema.hasPart = exams.map((exam) => ({
      '@type': 'Quiz',
      name: exam.title,
      url: examUrl(exam.id),
    }));
  }

  return schema;
}

function buildQuizSchema(exam: ExamWithQuestions): JsonLd {
  const pageUrl = examUrl(exam.id);
  const subject = exam.subject;

  const schema: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    '@id': `${pageUrl}#quiz`,
    name: exam.title,
    url: pageUrl,
    inLanguage: LOCALE,
    educationalLevel: EDUCATIONAL_LEVEL,
    learningResourceType: 'امتحان تفاعلي (اختيار من متعدد)',
    isAccessibleForFree: true,
    provider: organizationRef(),
    publisher: organizationRef(),
    audience: educationalAudience(),
    isPartOf: [websiteRef()],
  };

  if (exam.questions && exam.questions.length > 0) {
    schema.numberOfQuestions = exam.questions.length;
  }
  if (subject) {
    schema.about = subjectEntity(subject);
    schema.isPartOf.push({
      '@type': 'CollectionPage',
      '@id': `${subjectUrl(subject.slug)}#collection`,
      url: subjectUrl(subject.slug),
    });
  }
  if (exam.created_at) schema.datePublished = exam.created_at;
  if (exam.updated_at || exam.created_at) schema.dateModified = exam.updated_at || exam.created_at;

  return schema;
}

function buildAboutSchema(): JsonLd {
  const pageUrl = absoluteUrl('/about');
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: 'من نحن',
    description: PLATFORM_DESCRIPTION,
    inLanguage: LOCALE,
    isPartOf: websiteRef(),
    about: organizationRef(),
    mainEntity: organizationRef(),
  };
}

// ---- Public dispatcher ----

export type GeoPageInput =
  | { pageType: 'home'; resources: Resource[] }
  | { pageType: 'subjectListing'; subjects: Subject[] }
  | { pageType: 'subject'; subject: Subject; contentTypes?: ContentType[] }
  | { pageType: 'contentTypeListing'; subject: Subject; contentType: ContentType; resources: Resource[] }
  | { pageType: 'resource'; resource: Resource; description?: string }
  | { pageType: 'examListing'; subject?: Subject | null; exams: ExamWithQuestions[] }
  | { pageType: 'exam'; exam: ExamWithQuestions }
  | { pageType: 'about' };

/**
 * Builds the full JSON-LD payload for a page, including breadcrumbs, based on
 * the page type and the real data available at render time.
 */
export function buildPageSchema(input: GeoPageInput): JsonLd[] {
  switch (input.pageType) {
    case 'home':
      return [buildHomeSchema(input.resources)];

    case 'subjectListing':
      return [buildSubjectListingSchema(input.subjects), buildBreadcrumbList([{ name: 'المواد الدراسية' }])];

    case 'subject':
      return [
        buildSubjectCollectionSchema(input.subject, input.contentTypes),
        buildBreadcrumbList([{ name: input.subject.name }]),
      ];

    case 'contentTypeListing': {
      const { subject, contentType } = input;
      return [
        buildContentTypeCollectionSchema(subject, contentType, input.resources),
        buildBreadcrumbList([
          { name: subject.name, url: subjectUrl(subject.slug) },
          { name: contentType.name },
        ]),
      ];
    }

    case 'resource': {
      const { resource } = input;
      const trail: BreadcrumbEntry[] = [];
      if (resource.subject) {
        trail.push({ name: resource.subject.name, url: subjectUrl(resource.subject.slug) });
      }
      if (resource.subject && resource.content_type) {
        trail.push({
          name: resource.content_type.name,
          url: contentTypeUrl(resource.subject.slug, resource.content_type.slug),
        });
      }
      trail.push({ name: resource.title });
      return [buildLearningResourceSchema(resource, input.description), buildBreadcrumbList(trail)];
    }

    case 'examListing': {
      const trail: BreadcrumbEntry[] = [{ name: 'الامتحانات التفاعلية' }];
      return [buildExamListingSchema(input.subject, input.exams), buildBreadcrumbList(trail)];
    }

    case 'exam': {
      const { exam } = input;
      const trail: BreadcrumbEntry[] = [];
      if (exam.subject) {
        trail.push({ name: exam.subject.name, url: subjectUrl(exam.subject.slug) });
      } else {
        trail.push({ name: 'المادة', url: absoluteUrl('/exams') });
      }
      trail.push({ name: exam.title });
      return [buildQuizSchema(exam), buildBreadcrumbList(trail)];
    }

    case 'about':
      return [buildAboutSchema(), buildBreadcrumbList([{ name: 'من نحن' }])];
  }
}
