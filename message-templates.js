// ============================================================
// Gelo Growth OS — Message Templates
// Pre-built templates for outreach across all streams
// ============================================================

const MESSAGE_TEMPLATES = {

  // ── LinkedIn Lead Templates ──────────────────────────────────
  linkedin: [
    {
      id: 'li-connect',
      name: 'Connection Request',
      stage: 'New',
      channel: 'LinkedIn',
      subject: '',
      body: `Hi {{name}},

I came across your profile and was impressed by your work as {{role}} at {{company}}. {{interestSignal}}

I'd love to connect and exchange ideas on growth and operations. Looking forward to learning from your experience!

Best,
Gelo`,
      fields: ['name', 'role', 'company', 'interestSignal'],
    },
    {
      id: 'li-followup-1',
      name: 'First Follow-Up',
      stage: 'Contacted',
      channel: 'LinkedIn',
      subject: '',
      body: `Hey {{name}},

Thanks for connecting! I noticed {{interestSignal}} — that resonates with a lot of the work I do with founders and operators on streamlining their growth systems.

Would you be open to a quick chat about what's working (and what's not) in your operations right now? No pitch — just a genuine exchange.

Talk soon,
Gelo`,
      fields: ['name', 'interestSignal'],
    },
    {
      id: 'li-nurture',
      name: 'Nurture / Value Share',
      stage: 'Nurturing',
      channel: 'LinkedIn',
      subject: '',
      body: `Hi {{name}},

Thought of you when I put together this {{resourceType}} on {{topic}}. Given your role at {{company}}, I think you'll find it useful.

{{resourceLink}}

Happy to discuss any of it if it sparks ideas for your team!

Cheers,
Gelo`,
      fields: ['name', 'company', 'resourceType', 'topic', 'resourceLink'],
    },
    {
      id: 'li-convert',
      name: 'Conversion Offer',
      stage: 'Qualified',
      channel: 'LinkedIn',
      subject: '',
      body: `Hey {{name}},

We've had some great exchanges and I think there's a real opportunity to help {{company}} with {{serviceArea}}.

I offer a complimentary discovery session where we map out your biggest operational bottlenecks and explore practical solutions. Would you be open to a 30-minute call this week or next?

No pressure — just a conversation to see if there's a fit.

Best,
Gelo`,
      fields: ['name', 'company', 'serviceArea'],
    },
  ],

  // ── Prime Consultancy Templates ──────────────────────────────
  prime: [
    {
      id: 'pr-discovery',
      name: 'Discovery Meeting Request',
      stage: 'New Inquiry',
      channel: 'Email',
      subject: 'Exploring How We Can Help {{company}}',
      body: `Hi {{name}},

Thank you for your interest in working together. I'd love to understand more about the challenges you're facing at {{company}}, especially around {{problemArea}}.

Could we schedule a 30-45 minute discovery session? I'll come prepared with some initial observations and questions to make the most of our time.

What does your availability look like this week?

Best regards,
Gelo`,
      fields: ['name', 'company', 'problemArea'],
    },
    {
      id: 'pr-proposal-followup',
      name: 'Proposal Follow-Up',
      stage: 'Proposal Sent',
      channel: 'Email',
      subject: 'Following Up — {{company}} Proposal',
      body: `Hi {{name}},

I wanted to check in on the proposal I sent over on {{proposalDate}}. I hope you've had a chance to review the scope and approach.

Key highlights:
• {{serviceHighlight1}}
• {{serviceHighlight2}}
• Investment: {{estimatedValue}}

I'm happy to adjust the scope, walk through any section in more detail, or schedule a call with your team. What would be most helpful?

Looking forward to your thoughts.

Best,
Gelo`,
      fields: ['name', 'company', 'proposalDate', 'serviceHighlight1', 'serviceHighlight2', 'estimatedValue'],
    },
    {
      id: 'pr-won-kickoff',
      name: 'Won — Kickoff Message',
      stage: 'Won',
      channel: 'Email',
      subject: 'Welcome Aboard — Next Steps for {{company}}',
      body: `Hi {{name}},

I'm thrilled to officially kick off our work together! Here's what happens next:

1. 📋 Onboarding questionnaire (attached/linked)
2. 📅 Kickoff session — let's lock in a date
3. 📁 Shared workspace setup

Please complete the questionnaire before our kickoff so we can hit the ground running. I'll send a calendar invite once you confirm your availability.

Excited for the impact we're going to create!

Best,
Gelo`,
      fields: ['name', 'company'],
    },
  ],

  // ── Calmera Reconfirmation Templates ──────────────────────────
  calmera: [
    {
      id: 'cal-confirm-initial',
      name: 'Initial Reconfirmation',
      stage: 'Pending Contact',
      channel: 'Email / SMS',
      subject: 'Order Confirmation — {{orderRef}}',
      body: `Hi {{customerName}},

Thank you for your order ({{orderRef}})! Before we prepare it for delivery, we'd like to confirm the details:

📦 Items: {{itemsSummary}}
💰 Total: ₱{{orderAmount}}
📅 Fulfillment by: {{fulfillmentCutoff}}

Please reply to confirm, or let us know if you'd like to make any changes. We want to make sure everything is perfect!

Thank you,
Gelo / Calmera Team`,
      fields: ['customerName', 'orderRef', 'itemsSummary', 'orderAmount', 'fulfillmentCutoff'],
    },
    {
      id: 'cal-confirm-followup',
      name: 'Follow-Up (No Response)',
      stage: 'Awaiting Response',
      channel: 'Email / SMS',
      subject: 'Quick Follow-Up — Order {{orderRef}}',
      body: `Hi {{customerName}},

Just a friendly follow-up on your order ({{orderRef}}). We want to make sure we get this right before the fulfillment deadline on {{fulfillmentCutoff}}.

Could you quickly confirm the order details or let us know about any changes?

📦 {{itemsSummary}}
💰 ₱{{orderAmount}}

A simple "Confirmed" reply works! Thank you. 🙏

Gelo / Calmera Team`,
      fields: ['customerName', 'orderRef', 'itemsSummary', 'orderAmount', 'fulfillmentCutoff'],
    },
    {
      id: 'cal-escalation',
      name: 'Urgent Escalation',
      stage: 'Escalated',
      channel: 'Phone / SMS',
      subject: 'URGENT: Order {{orderRef}} Needs Your Response',
      body: `Hi {{customerName}},

We're reaching out urgently regarding your order ({{orderRef}}). Our fulfillment cutoff is {{fulfillmentCutoff}} and we haven't been able to confirm your order details.

To avoid any delays or issues, please contact us as soon as possible:
📞 [Phone number]
📧 [Email]

If we don't hear from you by {{responseDueAt}}, we may need to {{escalationAction}}.

Thank you for your understanding,
Gelo / Calmera Team`,
      fields: ['customerName', 'orderRef', 'fulfillmentCutoff', 'responseDueAt', 'escalationAction'],
    },
  ],

  // ── Self Care Club Templates ──────────────────────────────────
  scc: [
    {
      id: 'scc-engage',
      name: 'Community Engagement',
      stage: 'Published',
      channel: 'Social Media',
      subject: '',
      body: `🌿 {{title}}

{{hook}}

{{bodyContent}}

{{cta}}

#SelfCareClub #{{hashtag1}} #{{hashtag2}}`,
      fields: ['title', 'hook', 'bodyContent', 'cta', 'hashtag1', 'hashtag2'],
    },
    {
      id: 'scc-collab',
      name: 'Collaboration Invite',
      stage: 'Idea',
      channel: 'DM / Email',
      subject: 'Self Care Club Collaboration — {{topic}}',
      body: `Hi {{name}},

I run Self Care Club and your expertise in {{expertiseArea}} is exactly what our community loves.

Would you be interested in {{collabType}} with us? Our audience is {{audienceDesc}} and this would be a great way to share your knowledge while reaching a new community.

Let me know if you'd like to chat about it!

Warmly,
Gelo`,
      fields: ['name', 'topic', 'expertiseArea', 'collabType', 'audienceDesc'],
    },
  ],

  // ── General Follow-Up ────────────────────────────────────────
  general: [
    {
      id: 'gen-checkin',
      name: 'General Check-In',
      stage: 'Any',
      channel: 'Email / LinkedIn',
      subject: 'Quick Check-In',
      body: `Hi {{name}},

Just wanted to check in and see how things are going at {{company}}. It's been {{daysSinceLastContact}} since we last connected.

{{contextNote}}

Would love to catch up when you have a moment. What does your schedule look like?

Best,
Gelo`,
      fields: ['name', 'company', 'daysSinceLastContact', 'contextNote'],
    },
  ],
};

// ============================================================
// Template Engine
// ============================================================
class MessageGenerator {

  // Get templates for a specific stream
  static getTemplates(stream) {
    return MESSAGE_TEMPLATES[stream] || [];
  }

  // Get all template categories
  static getCategories() {
    return Object.keys(MESSAGE_TEMPLATES);
  }

  // Find a template by ID
  static getTemplateById(id) {
    for (const category of Object.values(MESSAGE_TEMPLATES)) {
      const found = category.find(t => t.id === id);
      if (found) return found;
    }
    return null;
  }

  // Fill a template with data
  static fillTemplate(template, data) {
    let subject = template.subject || '';
    let body = template.body || '';

    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replaceAll(placeholder, value || `[${key}]`);
      body = body.replaceAll(placeholder, value || `[${key}]`);
    }

    // Highlight unfilled placeholders
    subject = subject.replace(/\{\{(\w+)\}\}/g, '[$1]');
    body = body.replace(/\{\{(\w+)\}\}/g, '[$1]');

    return { subject, body };
  }

  // Auto-populate fields from a lead/record
  static autoPopulate(template, record) {
    const data = {};
    for (const field of template.fields) {
      // Map common field names to record properties
      const mappings = {
        name: record.contactName || record.fullName || record.customerName || '',
        company: record.company || record.orgName || record.organizationName || '',
        role: record.role || '',
        interestSignal: record.interestSignal || '',
        customerName: record.customerName || record.contactName || '',
        orderRef: record.externalOrderRef || record.orderId || '',
        itemsSummary: record.itemsSummary || '',
        orderAmount: record.orderAmount ? record.orderAmount.toLocaleString() : '',
        fulfillmentCutoff: record.fulfillmentCutoff || '',
        responseDueAt: record.responseDueAt || '',
        estimatedValue: record.estimatedValue ? '₱' + record.estimatedValue.toLocaleString() : '',
        proposalDate: record.proposalDate || '',
        problemArea: record.problemStatement || '',
        title: record.title || '',
        cta: record.cta || '',
      };
      data[field] = mappings[field] || '';
    }
    return data;
  }

  // Generate a message preview (filled template)
  static generatePreview(templateId, record) {
    const template = this.getTemplateById(templateId);
    if (!template) return null;

    const data = this.autoPopulate(template, record);
    return {
      template,
      data,
      ...this.fillTemplate(template, data),
    };
  }
}
