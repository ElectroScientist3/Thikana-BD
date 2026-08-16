// services/googleCalendar.js
const { google } = require('googleapis');
const { OAuth2 } = google.auth;

class GoogleCalendarService {
  constructor() {
    this.auth = null;
    this.calendar = null;
    this.initializeAuth();
  }

  initializeAuth() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground';
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.warn('⚠️ Google Calendar credentials not configured. Calendar sync will be disabled.');
      return;
    }

    this.auth = new OAuth2(clientId, clientSecret, redirectUri);
    this.auth.setCredentials({
      refresh_token: refreshToken
    });
    
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
    console.log('✅ Google Calendar service initialized successfully');
  }

  async createEvent(appointment, listing, tenant, owner) {
    if (!this.calendar) {
      console.warn('⚠️ Google Calendar not configured. Skipping event creation.');
      return null;
    }

    try {
      // Parse date and time
      const date = new Date(appointment.requested_date);
      const [hours, minutes] = appointment.requested_time.split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);

      const endTime = new Date(date);
      endTime.setMinutes(endTime.getMinutes() + (appointment.duration_minutes || 30));

      const event = {
        summary: `🏠 Property Viewing: ${listing.title}`,
        location: `${listing.area}, ${listing.city}`,
        description: `
Property Viewing Appointment

Property: ${listing.title}
Address: ${listing.area}, ${listing.city}
Rent: ৳${listing.monthly_rent_bdt?.toLocaleString() || 'N/A'}

Tenant: ${tenant.name}
Email: ${tenant.email}
Phone: ${tenant.phone || 'Not provided'}

Owner: ${owner.name}
Email: ${owner.email}
Phone: ${owner.phone || 'Not provided'}

Notes: ${appointment.notes || 'No additional notes'}

---
This event was created automatically by ThikanaBD.
        `.trim(),
        start: {
          dateTime: date.toISOString(),
          timeZone: 'Asia/Dhaka',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'Asia/Dhaka',
        },
        attendees: [
          { email: tenant.email },
          { email: owner.email }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 },
            { method: 'popup', minutes: 60 },
          ],
        },
        conferenceData: {
          createRequest: {
            requestId: `${appointment._id}-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        }
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendUpdates: 'all',
        conferenceDataVersion: 1,
      });

      console.log(`✅ Google Calendar event created: ${response.data.htmlLink}`);
      return {
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
        hangoutLink: response.data.hangoutLink,
      };
    } catch (error) {
      console.error('❌ Failed to create Google Calendar event:', error.message);
      throw error;
    }
  }

  async updateEvent(eventId, appointment, listing, tenant, owner) {
    if (!this.calendar || !eventId) {
      console.warn('⚠️ Google Calendar not configured or no event ID. Skipping update.');
      return null;
    }

    try {
      const date = new Date(appointment.requested_date);
      const [hours, minutes] = appointment.requested_time.split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);

      const endTime = new Date(date);
      endTime.setMinutes(endTime.getMinutes() + (appointment.duration_minutes || 30));

      const event = {
        summary: `🏠 Property Viewing: ${listing.title} (UPDATED)`,
        location: `${listing.area}, ${listing.city}`,
        description: `
Property Viewing Appointment (UPDATED)

Property: ${listing.title}
Address: ${listing.area}, ${listing.city}
Rent: ৳${listing.monthly_rent_bdt?.toLocaleString() || 'N/A'}

Tenant: ${tenant.name}
Email: ${tenant.email}
Phone: ${tenant.phone || 'Not provided'}

Owner: ${owner.name}
Email: ${owner.email}
Phone: ${owner.phone || 'Not provided'}

Notes: ${appointment.notes || 'No additional notes'}

---
This event was updated automatically by ThikanaBD.
        `.trim(),
        start: {
          dateTime: date.toISOString(),
          timeZone: 'Asia/Dhaka',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'Asia/Dhaka',
        },
        attendees: [
          { email: tenant.email },
          { email: owner.email }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 },
          ],
        }
      };

      const response = await this.calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        resource: event,
        sendUpdates: 'all',
      });

      console.log(`✅ Google Calendar event updated: ${response.data.htmlLink}`);
      return {
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
      };
    } catch (error) {
      console.error('❌ Failed to update Google Calendar event:', error.message);
      throw error;
    }
  }

  async deleteEvent(eventId) {
    if (!this.calendar || !eventId) {
      console.warn('⚠️ Google Calendar not configured or no event ID. Skipping deletion.');
      return null;
    }

    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'all',
      });
      console.log(`✅ Google Calendar event deleted: ${eventId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete Google Calendar event:', error.message);
      throw error;
    }
  }
}

module.exports = new GoogleCalendarService();