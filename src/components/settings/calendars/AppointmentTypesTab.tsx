import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Clock,
  MoreVertical,
  Edit2,
  Copy,
  Trash2,
  ExternalLink,
  Phone,
  Video,
  MapPin,
  Link as LinkIcon,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getCalendars } from '../../../services/calendars';
import { getDepartments } from '../../../services/departments';
import type { Calendar, Department, AppointmentType, LocationType } from '../../../types';
import { AppointmentTypeDrawer } from './AppointmentTypeDrawer';

const locationIcons: Record<LocationType, typeof Phone> = {
  phone: Phone,
  google_meet: Video,
  zoom: Video,
  in_person: MapPin,
  custom: LinkIcon,
};

const locationLabels: Record<LocationType, string> = {
  phone: 'Phone Call',
  google_meet: 'Google Meet',
  zoom: 'Zoom',
  in_person: 'In Person',
  custom: 'Custom',
};

export function AppointmentTypesTab() {
  const { user } = useAuth();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCalendarId, setFilterCalendarId] = useState('');
  const [filterDepartmentId, setFilterDepartmentId] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingType, setEditingType] = useState<AppointmentType | null>(null);
  const [editingCalendar, setEditingCalendar] = useState<Calendar | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const [calendarsData, departmentsData] = await Promise.all([
        getCalendars(user.organization_id),
        getDepartments(user.organization_id),
      ]);
      setCalendars(calendarsData);
      setDepartments(departmentsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const allAppointmentTypes = calendars.flatMap((calendar) =>
    (calendar.appointment_types || []).map((type) => ({
      ...type,
      calendar,
    }))
  );

  const filteredTypes = allAppointmentTypes.filter((type) => {
    if (searchQuery && !type.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterCalendarId && type.calendar_id !== filterCalendarId) {
      return false;
    }
    if (filterDepartmentId && type.calendar.department_id !== filterDepartmentId) {
      return false;
    }
    if (filterStatus === 'active' && !type.active) {
      return false;
    }
    if (filterStatus === 'inactive' && type.active) {
      return false;
    }
    return true;
  });

  const handleCreateType = () => {
    setEditingType(null);
    setEditingCalendar(null);
    setDrawerOpen(true);
  };

  const handleEditType = (type: AppointmentType & { calendar: Calendar }) => {
    setEditingType(type);
    setEditingCalendar(type.calendar);
    setDrawerOpen(true);
    setActiveMenu(null);
  };

  const handleCopyLink = (type: AppointmentType & { calendar: Calendar }) => {
    const bookingUrl = `${window.location.origin}/book/${type.calendar.slug}/${type.slug}`;
    navigator.clipboard.writeText(bookingUrl);
    setActiveMenu(null);
  };

  const handlePreview = (type: AppointmentType & { calendar: Calendar }) => {
    const bookingUrl = `${window.location.origin}/book/${type.calendar.slug}/${type.slug}`;
    window.open(bookingUrl, '_blank');
    setActiveMenu(null);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setEditingType(null);
    setEditingCalendar(null);
  };

  const handleDrawerSave = () => {
    loadData();
    handleDrawerClose();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (calendars.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">No calendars available</h3>
        <p className="text-slate-400 mb-6 max-w-md">
          Create a calendar first before adding appointment types.
        </p>
      </div>
    );
  }

  if (allAppointmentTypes.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No appointment types</h3>
          <p className="text-slate-400 mb-6 max-w-md">
            Create appointment types to define what people can book on your calendars.
          </p>
          <button
            onClick={handleCreateType}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-teal-600 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Appointment Type
          </button>
        </div>

        <AppointmentTypeDrawer
          open={drawerOpen}
          onClose={handleDrawerClose}
          onSave={handleDrawerSave}
          appointmentType={editingType}
          calendar={editingCalendar}
          calendars={calendars}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search appointment types..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-64"
              />
            </div>

            <select
              value={filterCalendarId}
              onChange={(e) => setFilterCalendarId(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">All Calendars</option>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                </option>
              ))}
            </select>

            <select
              value={filterDepartmentId}
              onChange={(e) => setFilterDepartmentId(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <button
            onClick={handleCreateType}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-teal-600 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Create Appointment Type
          </button>
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">Name</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">Calendar</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">Duration</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">Location</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">Status</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTypes.map((type) => {
                const LocationIcon = locationIcons[type.location_type] || LinkIcon;

                return (
                  <tr key={type.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                          <Clock className="w-4 h-4 text-cyan-400" />
                        </div>
                        <span className="text-white font-medium">{type.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{type.calendar.name}</td>
                    <td className="px-4 py-3 text-slate-300">{type.duration_minutes} min</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-300">
                        <LocationIcon className="w-4 h-4" />
                        <span>{locationLabels[type.location_type]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          type.active
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-500/20 text-slate-400'
                        }`}
                      >
                        {type.active ? (
                          <>
                            <Check className="w-3 h-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3" />
                            Inactive
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenu(activeMenu === type.id ? null : type.id)}
                            className="p-1 text-slate-400 hover:text-white rounded"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenu === type.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setActiveMenu(null)}
                              />
                              <div className="absolute right-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
                                <button
                                  onClick={() => handleEditType(type)}
                                  className="w-full px-4 py-2 text-left text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleCopyLink(type)}
                                  className="w-full px-4 py-2 text-left text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <Copy className="w-4 h-4" />
                                  Copy Booking URL
                                </button>
                                <button
                                  onClick={() => handlePreview(type)}
                                  className="w-full px-4 py-2 text-left text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  Preview
                                </button>
                                <button
                                  onClick={() => setActiveMenu(null)}
                                  className="w-full px-4 py-2 text-left text-red-400 hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredTypes.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              No appointment types match your filters
            </div>
          )}
        </div>
      </div>

      <AppointmentTypeDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        onSave={handleDrawerSave}
        appointmentType={editingType}
        calendar={editingCalendar}
        calendars={calendars}
      />
    </>
  );
}
